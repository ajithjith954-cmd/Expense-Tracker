import { Text, type TextStyle } from "react-native";

import { formatInr } from "@/utils/currency";

const figures: TextStyle = { fontVariant: ["tabular-nums"] };

type AmountProps = {
  value: number;
  size?: "display" | "row";
  sign?: "debit" | "credit" | "none";
};

export function Amount({ value, size = "row", sign = "none" }: AmountProps) {
  const prefix = sign === "credit" ? "+" : sign === "debit" ? "−" : "";
  const color = sign === "credit" ? "text-primary" : "text-ink";
  const scale = size === "display" ? "text-5xl font-semibold" : "text-base font-semibold";

  return (
    <Text
      accessibilityLabel={formatInr(value)}
      className={`${scale} ${color}`}
      style={figures}
    >
      {prefix}
      {formatInr(Math.abs(value))}
    </Text>
  );
}
