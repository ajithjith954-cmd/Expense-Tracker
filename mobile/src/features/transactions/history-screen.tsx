import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { TransactionRow } from "@/components/ui/transaction-row";
import { categoryLabel } from "@/domain/labels";
import { currentMonthKey, previousMonth } from "@/domain/summary";
import { useLedgerStore } from "@/state/use-ledger-store";

type DateFilter = "this-month" | "last-month" | "all";

const DATE_FILTERS: { id: DateFilter; label: string }[] = [
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "all", label: "All" },
];

export function HistoryScreen() {
  const transactions = useLedgerStore((state) => state.transactions);
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("this-month");
  const [category, setCategory] = useState<string | null>(null);
  const month = currentMonthKey();

  const categories = useMemo(() => {
    const names = new Set(transactions.map((transaction) => categoryLabel(transaction.category)));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return transactions
      .filter((transaction) => {
        if (dateFilter === "this-month" && !transaction.transactionDate.startsWith(month)) return false;
        if (dateFilter === "last-month" && !transaction.transactionDate.startsWith(previousMonth(month))) {
          return false;
        }
        if (category && categoryLabel(transaction.category) !== category) return false;
        if (!needle) return true;
        const haystack = [
          transaction.merchant,
          transaction.category,
          transaction.referenceNumber,
          String(transaction.amount),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate) || b.id.localeCompare(a.id));
  }, [category, dateFilter, month, query, transactions]);

  return (
    <Screen scroll>
      <Text accessibilityRole="header" className="text-3xl font-semibold text-ink">
        Transactions
      </Text>
      <TextInput
        accessibilityLabel="Search transactions"
        value={query}
        onChangeText={setQuery}
        placeholder="Search merchant or amount"
        placeholderTextColor="#3D463F"
        className="mt-5 min-h-12 rounded-lg border border-line bg-surface px-4 text-base text-ink"
      />

      <View className="mt-4 flex-row flex-wrap gap-2">
        {DATE_FILTERS.map((filter) => {
          const selected = dateFilter === filter.id;
          return (
            <Pressable
              key={filter.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setDateFilter(filter.id)}
              className={`min-h-12 justify-center rounded-full px-4 ${selected ? "bg-primary" : "bg-surface"}`}
            >
              <Text className={`text-sm font-semibold ${selected ? "text-onPrimary" : "text-ink"}`}>
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="mt-3 flex-row flex-wrap gap-2">
        <FilterChip label="All categories" selected={category === null} onPress={() => setCategory(null)} />
        {categories.map((name) => (
          <FilterChip
            key={name}
            label={name}
            selected={category === name}
            onPress={() => setCategory(name)}
          />
        ))}
      </View>

      <View className="mt-4">
        {visible.length === 0 ? (
          <Text className="text-base leading-6 text-mute">
            Nothing matches this search. Clear the filters to see the sample list again.
          </Text>
        ) : (
          visible.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              onPress={() => router.push(`/transaction/${transaction.id}`)}
            />
          ))
        )}
      </View>
    </Screen>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-12 justify-center rounded-full border px-4 ${selected ? "border-primary bg-primary" : "border-line bg-paper"}`}
    >
      <Text className={`text-sm font-semibold ${selected ? "text-onPrimary" : "text-ink"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
