import { router } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";

import { Amount } from "@/components/ui/amount";
import { DangerButton, PrimaryButton } from "@/components/ui/buttons";
import { Screen } from "@/components/ui/screen";
import { categoryLabel, exclusionLabel, merchantLabel, typeLabel } from "@/domain/labels";
import { useLedgerStore } from "@/state/use-ledger-store";
import { formatClock, formatDay } from "@/utils/dates";

type DetailScreenProps = {
  id: string;
};

export function DetailScreen({ id }: DetailScreenProps) {
  const transaction = useLedgerStore((state) =>
    state.transactions.find((item) => item.id === id),
  );
  const deleteTransaction = useLedgerStore((state) => state.deleteTransaction);

  if (!transaction) {
    return (
      <Screen>
        <Text accessibilityRole="header" className="text-3xl font-semibold text-ink">
          Transaction missing
        </Text>
        <Text className="mt-4 text-base leading-6 text-mute">
          This payment is no longer on the phone.
        </Text>
        <View className="mt-8">
          <PrimaryButton label="Back to history" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const exclusion = exclusionLabel(transaction);
  const time = formatClock(transaction.transactionTime);

  return (
    <Screen scroll footer={
      <View className="gap-2">
        <PrimaryButton label="Edit" onPress={() => router.push(`/transaction/edit/${transaction.id}`)} />
        <DangerButton
          label="Delete"
          onPress={() => {
            Alert.alert("Delete this transaction?", "The sample list will no longer include it.", [
              { text: "Keep", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => {
                  void deleteTransaction(transaction.id).then(() => router.back());
                },
              },
            ]);
          }}
        />
      </View>
    }>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        className="mb-4 min-h-12 justify-center self-start"
      >
        <Text className="text-base font-semibold text-primary">Back</Text>
      </Pressable>
      <Text accessibilityRole="header" className="text-base text-mute">
        {merchantLabel(transaction)}
      </Text>
      <View className="mt-2">
        <Amount value={transaction.amount} size="display" sign={transaction.direction ?? "none"} />
      </View>
      {exclusion ? <Text className="mt-3 text-base leading-6 text-ink">{exclusion}</Text> : null}

      <View className="mt-8">
        <Fact label="Category" value={categoryLabel(transaction.category)} />
        <Fact label="Type" value={typeLabel(transaction.transactionType)} />
        <Fact
          label="Direction"
          value={transaction.direction === "credit" ? "Credit" : transaction.direction === "debit" ? "Debit" : "Unknown"}
        />
        <Fact label="Date" value={formatDay(transaction.transactionDate)} />
        <Fact label="Time" value={time ?? "Unknown"} />
        <Fact label="Account" value={transaction.accountIdentifier ?? "Unknown"} />
        <Fact label="Reference" value={transaction.referenceNumber ?? "Unknown"} />
        <Fact label="Source" value="Sample" />
      </View>
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-h-12 flex-row items-center justify-between gap-4 border-b border-line">
      <Text className="text-base text-mute">{label}</Text>
      <Text className="flex-1 text-right text-base font-medium text-ink">{value}</Text>
    </View>
  );
}
