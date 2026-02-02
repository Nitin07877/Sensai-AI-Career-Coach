import OnboardingForm from "./_components/onboarding-form"
import { industries } from "@/data/industries"
import { getUserOnboardingStatus } from "@/actions/user";
import { redirect } from "next/navigation";

const onboardingPage = async() => {
    const { isOnboarded } = await getUserOnboardingStatus();

    if (isOnboarded) {
        redirect("/dashboard");
    }
    return (

        <main>
            <OnboardingForm industries={industries} />
        </main>
    )
}

export default onboardingPage