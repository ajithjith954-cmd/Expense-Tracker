import "../../global.css";

import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { AppState, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/ui/buttons";
import { useLedgerStore } from "@/state/use-ledger-store";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    MaterialIcons: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf"),
  });
  const ready = useLedgerStore((state) => state.ready);
  const databaseError = useLedgerStore((state) => state.databaseError);
  const hydrate = useLedgerStore((state) => state.hydrate);
  const refreshFromPhone = useLedgerStore((state) => state.refreshFromPhone);
  const trackingEnabled = useLedgerStore((state) => state.trackingEnabled);

  useEffect(() => {
    if (fontsLoaded) void hydrate();
  }, [fontsLoaded, hydrate]);

  useEffect(() => {
    if (!ready || !trackingEnabled) return;
    const tick = () => void refreshFromPhone();
    const timer = setInterval(tick, 8000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [ready, trackingEnabled, refreshFromPhone]);

  if (!fontsLoaded || (!ready && !databaseError)) return null;

  if (databaseError) {
    return (
      <SafeAreaProvider>
        <View className="flex-1 justify-center bg-paper px-6">
          <Text className="text-2xl font-semibold text-ink">The ledger did not open</Text>
          <Text className="mt-3 text-base leading-6 text-mute">{databaseError}</Text>
          <View className="mt-6">
            <PrimaryButton label="Try again" onPress={() => void hydrate()} />
          </View>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#F6F7F4" },
        }}
      />
    </SafeAreaProvider>
  );
}
