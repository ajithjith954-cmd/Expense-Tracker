import { Pressable, Text } from "react-native";

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function PrimaryButton({ label, onPress, disabled = false }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: "#ffffff33" }}
      className={`min-h-12 items-center justify-center rounded-full px-6 ${disabled ? "bg-line" : "bg-primary"}`}
    >
      <Text className={`text-base font-semibold ${disabled ? "text-mute" : "text-onPrimary"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TextButton({ label, onPress }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-12 items-center justify-center px-4"
    >
      <Text className="text-base font-semibold text-primary">{label}</Text>
    </Pressable>
  );
}

export function DangerButton({ label, onPress }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-12 items-center justify-center rounded-full border border-danger px-6"
    >
      <Text className="text-base font-semibold text-danger">{label}</Text>
    </Pressable>
  );
}
