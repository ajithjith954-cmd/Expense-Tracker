import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
};

export function Screen({ children, scroll = false, footer }: ScreenProps) {
  const body = scroll ? (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 128 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View className="flex-1 px-6 pb-6 pt-6">{children}</View>
  );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
      <View className="flex-1 bg-paper">
        {body}
        {footer ? <View className="bg-paper px-6 pb-6">{footer}</View> : null}
      </View>
    </SafeAreaView>
  );
}
