import { Redirect } from "expo-router";

import { useLedgerStore } from "@/state/use-ledger-store";

export default function Index() {
  const onboardingComplete = useLedgerStore((state) => state.onboardingComplete);
  if (!onboardingComplete) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
