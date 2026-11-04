import { Alert, Pressable, Share, Switch, Text, View } from "react-native";

import { DangerButton, TextButton } from "@/components/ui/buttons";
import { Screen } from "@/components/ui/screen";
import { useLedgerStore } from "@/state/use-ledger-store";

export function SettingsScreen() {
  const consentGranted = useLedgerStore((state) => state.consentGranted);
  const trackingEnabled = useLedgerStore((state) => state.trackingEnabled);
  const smsPermission = useLedgerStore((state) => state.smsPermission);
  const lastSyncAt = useLedgerStore((state) => state.lastSyncAt);
  const transactions = useLedgerStore((state) => state.transactions);
  const requestSmsAccess = useLedgerStore((state) => state.requestSmsAccess);
  const setTrackingEnabled = useLedgerStore((state) => state.setTrackingEnabled);
  const revokeSmsConsent = useLedgerStore((state) => state.revokeSmsConsent);
  const deleteAllTransactions = useLedgerStore((state) => state.deleteAllTransactions);
  const restoreSamples = useLedgerStore((state) => state.restoreSamples);
  const lastCaptured = transactions.find((transaction) => transaction.source !== "sample");

  return (
    <Screen scroll>
      <Text accessibilityRole="header" className="text-3xl font-semibold text-ink">
        Settings
      </Text>

      <View className="mt-8 min-h-16 flex-row items-center justify-between gap-4 border-b border-line py-3">
        <View className="flex-1">
          <Text className="text-base font-medium text-ink">Automatic tracking</Text>
          <Text className="mt-1 text-sm leading-5 text-mute">
            {smsPermission !== "granted"
              ? "SMS access is off. Tap SMS permission below and choose Allow."
              : trackingEnabled
                ? "Tracking is on. New bank alerts can be saved."
                : "Tracking is off. No messages are read."}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Automatic tracking"
          value={trackingEnabled && smsPermission === "granted"}
          onValueChange={(enabled) => void setTrackingEnabled(enabled)}
          trackColor={{ false: "#D5D9D2", true: "#123A63" }}
          thumbColor="#FFFFFF"
        />
      </View>

      {smsPermission === "granted" ? (
        <SettingRow label="SMS permission" value="Granted" />
      ) : (
        <Pressable accessibilityRole="button" onPress={() => void requestSmsAccess()}>
          <SettingRow label="SMS permission" value="Tap to allow" />
        </Pressable>
      )}
      <SettingRow label="Consent" value={consentGranted ? "Saved" : "Not saved"} />
      <SettingRow
        label="Last captured transaction"
        value={lastCaptured ? lastCaptured.merchant ?? "Unknown merchant" : "None yet"}
      />
      <SettingRow label="Last synchronization" value={formatSync(lastSyncAt)} />
      <SettingRow
        label="Data storage"
        value="Transactions are stored in SQLite on this phone and stay there after a reload."
      />

      <Text accessibilityRole="header" className="mb-2 mt-10 text-xl font-semibold text-ink">
        Privacy
      </Text>
      <Text className="text-base leading-6 text-mute">
        The app keeps the amount, merchant, date, and a masked account. It does not keep the full text message or use it for advertising. A familiar alert is saved on the phone. An unfamiliar alert can be sent to the server, where Gemini reads it. The key stays off this phone.
      </Text>
      {consentGranted ? (
        <TextButton label="Revoke consent" onPress={revokeSmsConsent} />
      ) : null}

      <View className="mt-8 gap-3">
        <DangerButton
          label="Delete transaction data"
          onPress={() => {
            Alert.alert(
              "Delete all transactions?",
              "The payments stored on this phone will be removed. Categories and accounts stay.",
              [
                { text: "Keep", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: deleteAllTransactions },
              ],
            );
          }}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void Share.share({ title: "Transactions", message: toCsv(transactions) });
          }}
          className="min-h-12 items-center justify-center rounded-full bg-primary px-6"
        >
          <Text className="text-base font-semibold text-onPrimary">Export transactions</Text>
        </Pressable>
        <TextButton label="Restore sample data" onPress={restoreSamples} />
      </View>
    </Screen>
  );
}

function formatSync(value: string | null): string {
  if (!value) return "None yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "None yet";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-h-16 justify-center border-b border-line py-3">
      <Text className="text-base font-medium text-ink">{label}</Text>
      <Text className="mt-1 text-sm leading-5 text-mute">{value}</Text>
    </View>
  );
}

function toCsv(
  transactions: {
    transactionDate: string;
    transactionTime: string | null;
    merchant: string | null;
    amount: number;
    direction: string | null;
    transactionType: string;
    category: string | null;
    accountIdentifier: string | null;
    referenceNumber: string | null;
  }[],
): string {
  const header = "date,time,merchant,amount,direction,type,category,account,reference";
  const lines = transactions.map((transaction) =>
    [
      transaction.transactionDate,
      transaction.transactionTime ?? "",
      transaction.merchant ?? "",
      transaction.amount,
      transaction.direction ?? "",
      transaction.transactionType,
      transaction.category ?? "",
      transaction.accountIdentifier ?? "",
      transaction.referenceNumber ?? "",
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","),
  );
  return [header, ...lines].join("\n");
}
