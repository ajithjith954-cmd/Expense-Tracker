import { router } from "expo-router";

import { useLedgerStore } from "@/state/use-ledger-store";

import { OnboardingStep } from "./step";

export function WelcomeScreen() {
  return (
    <OnboardingStep
      title="See spending without typing it"
      body="Expense Tracker is meant to read bank text messages and turn payments into a list. You can correct or delete any line later."
      primaryLabel="Continue"
      onPrimary={() => router.push("/onboarding/tracking")}
    />
  );
}

export function TrackingScreen() {
  return (
    <OnboardingStep
      title="Known payments are saved on their own"
      body={"A familiar bank message can be saved without asking you to confirm it.\n\nAn unfamiliar financial message can be sent for reading later. Codes, offers, and other messages are ignored."}
      primaryLabel="Continue"
      onPrimary={() => router.push("/onboarding/sms")}
      secondaryLabel="Back"
      onSecondary={() => router.back()}
    />
  );
}

export function SmsReasonScreen() {
  return (
    <OnboardingStep
      title="SMS access is for bank alerts"
      body={"Payment alerts arrive as text messages. The app needs new messages so it can keep the ones about money.\n\nIt does not replace your messaging app, and it does not send texts."}
      primaryLabel="Continue"
      onPrimary={() => router.push("/onboarding/privacy")}
      secondaryLabel="Back"
      onSecondary={() => router.back()}
    />
  );
}

export function PrivacyScreen() {
  return (
    <OnboardingStep
      title="What is kept"
      body={"The amount, merchant, date, and a masked account can be stored. The full message is not kept after those details are taken.\n\nNothing here is used for advertising. An unfamiliar payment may later be sent to Google Gemini through a server. That connection is not active in this build."}
      primaryLabel="I understand"
      onPrimary={() => router.push("/onboarding/permission")}
      secondaryLabel="Back"
      onSecondary={() => router.back()}
    />
  );
}

export function PermissionScreen() {
  const finishOnboarding = useLedgerStore((state) => state.finishOnboarding);

  return (
    <OnboardingStep
      title="SMS access comes with the capture update"
      body={"Android will ask to read text messages. Allow it so bank alerts can be saved. One-time passwords are ignored.\n\nYou can allow it now, or continue without it. The sample dashboard works either way."}
      primaryLabel="Allow SMS access"
      onPrimary={() => {
        void finishOnboarding("consent").then(() => router.replace("/onboarding/activated"));
      }}
      secondaryLabel="Not now"
      onSecondary={() => {
        finishOnboarding("decline");
        router.replace("/onboarding/activated");
      }}
    />
  );
}

export function ActivatedScreen() {
  return (
    <OnboardingStep
      title="The sample month is ready"
      body="The figures ahead are sample payments, so the screens can be learned. Your bank has not been read."
      primaryLabel="See the sample month"
      onPrimary={() => router.replace("/(tabs)")}
    />
  );
}
