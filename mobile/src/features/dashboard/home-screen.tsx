import { router } from "expo-router";
import { Text, View } from "react-native";

import { Amount } from "@/components/ui/amount";
import { CategoryBar } from "@/components/ui/category-bar";
import { Screen } from "@/components/ui/screen";
import { TransactionRow } from "@/components/ui/transaction-row";
import {
  compareWithPrevious,
  currentMonthKey,
  monthsWithActivity,
  summarizeMonth,
} from "@/domain/summary";
import { useLedgerStore } from "@/state/use-ledger-store";
import { formatInr } from "@/utils/currency";
import { formatMonth, formatShortMonth } from "@/utils/dates";

export function HomeScreen() {
  const transactions = useLedgerStore((state) => state.transactions);
  const month = currentMonthKey();
  const summary = summarizeMonth(transactions, month);
  const comparison = compareWithPrevious(transactions, month);
  const recent = transactions
    .filter((transaction) => transaction.transactionDate.startsWith(month))
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate) || b.id.localeCompare(a.id))
    .slice(0, 5);
  const trend = monthsWithActivity(transactions).slice(-4).map((key) => ({
    key,
    spent: summarizeMonth(transactions, key).spent,
  }));
  const captured = transactions.some((transaction) => transaction.source === "sms");
  const peak = Math.max(...trend.map((item) => item.spent), 1);

  return (
    <Screen scroll>
      <Text accessibilityRole="header" className="text-3xl font-semibold text-ink">
        {formatMonth(month)}
      </Text>
      <Text className="mt-2 text-base leading-6 text-mute">
        {captured
          ? "Includes payments captured from bank alerts."
          : "Sample transactions, not your bank."}
      </Text>

      <Text className="mt-8 text-base text-mute">Spent</Text>
      <Amount value={summary.spent} size="display" />
      <Text className="mt-4 text-base leading-6 text-ink">
        Received {formatInr(summary.received)}
      </Text>
      <Text className="mt-1 text-base leading-6 text-ink">Net {formatInr(summary.net)}</Text>
      <Text className="mt-3 text-base leading-6 text-mute">
        Transfers, card bills, and failed payments stay in the list. They are not part of this
        spent total.
      </Text>

      <Text accessibilityRole="header" className="mb-3 mt-10 text-xl font-semibold text-ink">
        Where it went
      </Text>
      {summary.categories.length === 0 ? (
        <Text className="text-base leading-6 text-mute">No spending in this month yet.</Text>
      ) : (
        summary.categories.map((category) => {
          const share = category.amount / summary.categories[0].amount;
          const accent = category.name === summary.highest?.name;
          return (
            <View key={category.name} className="mb-4">
              <View className="flex-row items-baseline justify-between gap-4">
                <Text className="text-base text-ink">{category.name}</Text>
                <Text className="text-base font-medium text-ink" style={{ fontVariant: ["tabular-nums"] }}>
                  {formatInr(category.amount)}
                </Text>
              </View>
              <CategoryBar fraction={share} accent={accent} />
            </View>
          );
        })
      )}
      {summary.highest ? (
        <Text className="text-base leading-6 text-ink">
          {summary.highest.name} is the highest category, at {formatInr(summary.highest.amount)}.
        </Text>
      ) : null}

      <Text accessibilityRole="header" className="mb-1 mt-10 text-xl font-semibold text-ink">
        Recent months
      </Text>
      {comparison.status === "ready" ? (
        <Text className="mb-4 text-base leading-6 text-mute">
          {comparison.difference === 0
            ? "Spending matches last month."
            : comparison.difference < 0
              ? `${formatInr(Math.abs(comparison.difference))} less than last month.`
              : `${formatInr(comparison.difference)} more than last month.`}
        </Text>
      ) : (
        <Text className="mb-4 text-base leading-6 text-mute">
          A comparison appears after both months have at least three expenses.
        </Text>
      )}
      <View className="flex-row items-end gap-6">
        {trend.map((item) => (
          <View key={item.key} className="flex-1 items-center justify-end">
            <Text className="mb-2 text-sm text-ink" style={{ fontVariant: ["tabular-nums"] }}>
              {formatInr(item.spent)}
            </Text>
            <View
              className={`w-8 rounded-sm ${item.key === month ? "bg-primary" : "bg-ink"}`}
              style={{ height: Math.max(8, (item.spent / peak) * 72) }}
            />
            <Text className="mt-2 text-sm text-mute">{formatShortMonth(item.key)}</Text>
          </View>
        ))}
      </View>

      <Text accessibilityRole="header" className="mb-1 mt-10 text-xl font-semibold text-ink">
        Recent
      </Text>
      {recent.length === 0 ? (
        <Text className="text-base leading-6 text-mute">No transactions this month.</Text>
      ) : (
        recent.map((transaction) => (
          <TransactionRow
            key={transaction.id}
            transaction={transaction}
            onPress={() => router.push(`/transaction/${transaction.id}`)}
          />
        ))
      )}
      </Screen>
  );
}
