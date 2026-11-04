import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "@/components/ui/buttons";
import { Screen } from "@/components/ui/screen";
import { CATEGORY_OPTIONS } from "@/domain/samples";
import { useLedgerStore } from "@/state/use-ledger-store";
import { TRANSACTION_TYPES, type MoneyDirection, type TransactionType } from "@/types/transaction";
import { typeLabel } from "@/domain/labels";

type EditScreenProps = {
  id: string;
};

export function EditScreen({ id }: EditScreenProps) {
  const transaction = useLedgerStore((state) => state.transactions.find((item) => item.id === id));
  const updateTransaction = useLedgerStore((state) => state.updateTransaction);
  const [merchant, setMerchant] = useState(transaction?.merchant ?? "");
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "");
  const [category, setCategory] = useState(transaction?.category ?? "Uncategorized");
  const [transactionType, setTransactionType] = useState<TransactionType>(
    transaction?.transactionType ?? "expense",
  );
  const [direction, setDirection] = useState<MoneyDirection>(transaction?.direction ?? "debit");
  const [error, setError] = useState<string | null>(null);

  if (!transaction) {
    return (
      <Screen>
        <Text className="text-3xl font-semibold text-ink">Transaction missing</Text>
        <View className="mt-8">
          <PrimaryButton label="Back" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      footer={
        <PrimaryButton
          label="Save"
          onPress={() => {
            const parsed = Number(amount);
            if (!Number.isFinite(parsed) || parsed <= 0) {
              setError("Enter an amount greater than zero.");
              return;
            }
            void updateTransaction(transaction.id, {
              merchant: merchant.trim() ? merchant.trim() : null,
              amount: Math.round(parsed * 100) / 100,
              category: category === "Uncategorized" ? null : category,
              transactionType,
              direction,
            }).then(() => router.back());
          }}
        />
      }
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        className="mb-4 min-h-12 justify-center self-start"
      >
        <Text className="text-base font-semibold text-primary">Back</Text>
      </Pressable>
      <Text accessibilityRole="header" className="text-3xl font-semibold text-ink">
        Edit transaction
      </Text>

      <Field label="Merchant">
        <TextInput
          accessibilityLabel="Merchant"
          value={merchant}
          onChangeText={setMerchant}
          placeholder="Unknown merchant"
          placeholderTextColor="#3D463F"
          className="min-h-12 rounded-lg border border-line bg-surface px-4 text-base text-ink"
        />
      </Field>

      <Field label="Amount">
        <TextInput
          accessibilityLabel="Amount in rupees"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          className="min-h-12 rounded-lg border border-line bg-surface px-4 text-base text-ink"
        />
      </Field>
      {error ? <Text className="mt-2 text-base text-danger">{error}</Text> : null}

      <Field label="Category">
        <View className="flex-row flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((option) => (
            <Choice
              key={option}
              label={option}
              selected={(category ?? "Uncategorized") === option}
              onPress={() => setCategory(option)}
            />
          ))}
        </View>
      </Field>

      <Field label="Type">
        <View className="flex-row flex-wrap gap-2">
          {TRANSACTION_TYPES.map((option) => (
            <Choice
              key={option}
              label={typeLabel(option)}
              selected={transactionType === option}
              onPress={() => setTransactionType(option)}
            />
          ))}
        </View>
      </Field>

      <Field label="Direction">
        <View className="flex-row gap-2">
          <Choice label="Debit" selected={direction === "debit"} onPress={() => setDirection("debit")} />
          <Choice label="Credit" selected={direction === "credit"} onPress={() => setDirection("credit")} />
        </View>
      </Field>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="mt-6">
      <Text className="mb-2 text-base font-medium text-ink">{label}</Text>
      {children}
    </View>
  );
}

function Choice({
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
      className={`min-h-12 justify-center rounded-full px-4 ${selected ? "bg-primary" : "bg-surface"}`}
    >
      <Text className={`text-sm font-semibold ${selected ? "text-onPrimary" : "text-ink"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
