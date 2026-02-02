"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { generateAIInsights } from "./dashboard";

// helper to match Prisma enums (VERY important)
const normalizeEnum = (value) => value?.toUpperCase();

export async function updateUser(data) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  try {
    // ✅ 1. AI CALL OUTSIDE TRANSACTION (CRITICAL FIX)
    let insights = null;

    const existingInsight = await db.industryInsight.findUnique({
      where: { industry: data.industry },
    });

    if (!existingInsight) {
      insights = await generateAIInsights(data.industry);
    }

    // ✅ 2. FAST DB-ONLY TRANSACTION
    const result = await db.$transaction(async (tx) => {
      let industryInsight = existingInsight;

      if (!industryInsight && insights) {
        industryInsight = await tx.industryInsight.create({
          data: {
            industry: data.industry,
            salaryRanges: insights.salaryRanges,
            growthRate: insights.growthRate,
            demandLevel: normalizeEnum(insights.demandLevel),
            marketOutlook: normalizeEnum(insights.marketOutlook),
            topSkills: insights.topSkills,
            keyTrends: insights.keyTrends,
            recommendedSkills: insights.recommendedSkills,
            nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      }

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          industry: data.industry,
          experience: data.experience,
          bio: data.bio,
          skills: data.skills,
        },
      });

      return { updatedUser, industryInsight };
    });

    revalidatePath("/");
    return result.updatedUser;
  } catch (error) {
    console.error("Error updating user and industry:", error.message);
    throw new Error("Failed to update profile");
  }
}

export async function getUserOnboardingStatus() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { industry: true },
  });

  if (!user) throw new Error("User not found");

  return {
    isOnboarded: !!user.industry,
  };
}
