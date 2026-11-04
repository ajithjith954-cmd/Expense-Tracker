import { Text, View } from "react-native";

import { CategoryBar } from "@/components/ui/category-bar";
import { Screen } from "@/components/ui/screen";
import { compareWithPrevious, currentMonthKey, monthsWithActivity, summarizeMonth } from "@/domain/summary";
import { useLedgerStore } from "@/state/use-ledger-store";
import { formatInr } from "@/utils/currency";
import { formatMonth, formatShortMonth } from "@/utils/dates";

export function InsightsScreen() {
  const transactions = useLedgerStore((state) => state.transactions);
  const month = currentMonthKey();
  const comparison = compareWithPrevious(transactions, month);
  const summary = comparison.current;
  const trend = monthsWithActivity(transactions).map((key) => ({
    key,
    spent: summarizeMonth(transactions, key).spent,
  }));
  const peak = Math.max(...trend.map((item) => item.spent), 1);

  return (
    <Screen scroll>
      <Text accessibilityRole="header" className="text-3xl font-semibold text-ink">
        Insights
      </Text>
      <Text className="mt-2 text-base leading-6 text-mute">
        These readings use the sample payments only.
      </Text>

      <Text className="mt-8 text-base text-mute">Spent in {formatMonth(month)}</Text>
      <Text className="mt-1 text-4xl font-semibold text-ink" style={{ fontVariant: ["tabular-nums"] }}>
        {formatInr(summary.spent)}
      </Text>

      <Text accessibilityRole="header" className="mb-3 mt-10 text-xl font-semibold text-ink">
        Categories
      </Text>
      {summary.categories.length === 0 ? (
        <Text className="text-base leading-6 text-mute">No spending in this month yet.</Text>
      ) : (
        summary.categories.map((category) => (
          <View key={category.name} className="mb-4">
            <View className="flex-row items-baseline justify-between gap-4">
              <Text className="text-base text-ink">{category.name}</Text>
              <Text className="text-base font-medium text-ink" style={{ fontVariant: ["tabular-nums"] }}>
                {formatInr(category.amount)}
              </Text>
            </View>
            <CategoryBar
              fraction={category.amount / summary.categories[0].amount}
              accent={category.name === summary.highest?.name}
            />
          </View>
        ))
      )}

      <Text accessibilityRole="header" className="mb-3 mt-8 text-xl font-semibold text-ink">
        Compared with last month
      </Text>
      {comparison.status === "insufficient" ? (
        <Text className="text-base leading-6 text-mute">
          There are not enough expenses in both months to compare them. Three expenses in each
          month are the minimum.
        </Text>
      ) : (
        <Text className="text-base leading-6 text-ink">
          {formatMonth(comparison.previous.month)} was {formatInr(comparison.previous.spent)}.{" "}
          {comparison.difference === 0
            ? "This month matches it."
            : comparison.difference < 0
              ? `This month is ${formatInr(Math.abs(comparison.difference))} lower.`
              : `This month is ${formatInr(comparison.difference)} higher.`}
        </Text>
      )}

      <Text accessibilityRole="header" className="mb-3 mt-10 text-xl font-semibold text-ink">
        Highest category
      </Text>
      <Text className="text-base leading-6 text-ink">
        {summary.highest
          ? `${summary.highest.name}, at ${formatInr(summary.highest.amount)}.`
          : "No category yet."}
      </Text>

      <Text accessibilityRole="header" className="mb-4 mt-10 text-xl font-semibold text-ink">
        Spending by month
      </Text>
      {trend.length === 0 ? (
        <Text className="text-base leading-6 text-mute">No transactions to chart.</Text>
      ) : (
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
      )}
    </Screen>
  );
}
