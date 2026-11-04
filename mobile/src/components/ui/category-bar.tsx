import { View, type DimensionValue } from "react-native";

type CategoryBarProps = {
  fraction: number;
  accent: boolean;
};

export function CategoryBar({ fraction, accent }: CategoryBarProps) {
  const width: DimensionValue = `${Math.round(Math.max(0, Math.min(fraction, 1)) * 100)}%`;

  return (
    <View className="mt-2 h-2 overflow-hidden rounded-full bg-line">
      <View
        style={{
          width,
          height: 8,
          backgroundColor: accent ? "#123A63" : "#1B1C19",
        }}
      />
    </View>
  );
}
