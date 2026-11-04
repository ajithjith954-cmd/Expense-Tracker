import { Pressable, Text, View } from "react-native";

import { categoryLabel, exclusionLabel, merchantLabel, typeLabel } from "@/domain/labels";
import type { LedgerTransaction } from "@/types/transaction";
import { formatClock, formatDay } from "@/utils/dates";

import { Amount } from "./amount";

type TransactionRowProps = {
  transaction: LedgerTransaction;
  onPress: () => void;
};

export function TransactionRow({ transaction, onPress }: TransactionRowProps) {
  const exclusion = exclusionLabel(transaction);
  const time = formatClock(transaction.transactionTime);
  const detail = [
    transaction.transactionType === "expense"
      ? categoryLabel(transaction.category)
      : typeLabel(transaction.transactionType),
    formatDay(transaction.transactionDate),
    time,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${merchantLabel(transaction)}, ${detail}`}
      onPress={onPress}
      className="min-h-16 flex-row items-center justify-between gap-4 border-b border-line py-3"
    >
      <View className="flex-1">
        <Text className="text-base font-medium text-ink">{merchantLabel(transaction)}</Text>
        <Text className="mt-1 text-sm leading-5 text-mute">
          {detail}
          {exclusion ? ` · ${exclusion}` : ""}
        </Text>
      </View>
      <Amount
        value={transaction.amount}
        sign={
          transaction.transactionType === "failed"
            ? "none"
            : transaction.direction === "credit"
              ? "credit"
              : transaction.direction === "debit"
                ? "debit"
                : "none"
        }
      />
    </Pressable>
  );
}
