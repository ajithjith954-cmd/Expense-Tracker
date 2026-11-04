import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PrimaryButton, TextButton } from "@/components/ui/buttons";

type StepProps = {
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export function OnboardingStep({
  title,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: StepProps) {
  const paragraphs = body.split("\n\n");

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View className="flex-1 justify-between bg-paper px-6 py-8">
        <View>
          <Text accessibilityRole="header" className="text-3xl font-semibold leading-10 text-ink">
            {title}
          </Text>
          <View className="mt-5 gap-4">
            {paragraphs.map((paragraph) => (
              <Text key={paragraph} className="text-base leading-7 text-mute">
                {paragraph}
              </Text>
            ))}
          </View>
        </View>
        <View className="gap-2">
          <PrimaryButton label={primaryLabel} onPress={onPrimary} />
          {secondaryLabel && onSecondary ? (
            <TextButton label={secondaryLabel} onPress={onSecondary} />
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
