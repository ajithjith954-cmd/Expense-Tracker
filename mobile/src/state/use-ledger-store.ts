import { create } from "zustand";

import { getDatabase } from "@/database/client";
import {
  deleteAllTransactions as deleteAllRows,
  deleteTransactionRecord,
  ensureSampleData,
  loadSnapshot,
  migrate,
  restoreSampleTransactions,
  savePreferences,
  updateTransactionRecord,
} from "@/database/repository";
import { syncCapturedSms } from "@/services/sync-capture";
import { requestReceiveSms } from "@/native/sms-bridge";
import type { LedgerTransaction, SmsPermissionStatus } from "@/types/transaction";

export type { SmsPermissionStatus };

type Preferences = {
  onboardingComplete: boolean;
  consentGranted: boolean;
  trackingEnabled: boolean;
  smsPermission: SmsPermissionStatus;
};

type LedgerState = Preferences & {
  ready: boolean;
  databaseError: string | null;
  lastSyncAt: string | null;
  transactions: LedgerTransaction[];
  hydrate: () => Promise<void>;
  finishOnboarding: (choice: "consent" | "decline") => Promise<void>;
  setTrackingEnabled: (enabled: boolean) => Promise<void>;
  revokeSmsConsent: () => Promise<void>;
  requestSmsAccess: () => Promise<void>;
  refreshFromPhone: () => Promise<void>;
  updateTransaction: (id: string, patch: Partial<LedgerTransaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  deleteAllTransactions: () => Promise<void>;
  restoreSamples: () => Promise<void>;
};

let hydration: Promise<void> | null = null;

export const useLedgerStore = create<LedgerState>((set, get) => ({
  ready: false,
  databaseError: null,
  onboardingComplete: false,
  consentGranted: false,
  trackingEnabled: false,
  smsPermission: "undetermined",
  lastSyncAt: null,
  transactions: [],
  hydrate: () => {
    hydration ??= hydrateLedger(set).catch((error: unknown) => {
      hydration = null;
      set({
        ready: false,
        databaseError: error instanceof Error ? error.message : "The local database could not be opened.",
      });
    });
    return hydration;
  },
  finishOnboarding: async (choice) => {
    const granted = choice === "consent" && (await requestReceiveSms()) === "granted";
    const next: Preferences = {
      onboardingComplete: true,
      consentGranted: choice === "consent",
      trackingEnabled: granted,
      smsPermission: choice === "decline" ? "denied" : granted ? "granted" : "denied",
    };
    await persistPreferences(next);
    set(next);
    await syncCapturedSms(await getDatabase(), next);
  },
  setTrackingEnabled: async (enabled) => {
    if (enabled) {
      await get().requestSmsAccess();
      return;
    }
    const next = preferencesFrom(get(), { trackingEnabled: false });
    await persistPreferences(next);
    set({ trackingEnabled: false });
    await syncCapturedSms(await getDatabase(), next);
  },
  revokeSmsConsent: async () => {
    const next: Preferences = {
      onboardingComplete: get().onboardingComplete,
      consentGranted: false,
      trackingEnabled: false,
      smsPermission: "revoked",
    };
    await persistPreferences(next);
    set(next);
    await syncCapturedSms(await getDatabase(), next);
  },
  requestSmsAccess: async () => {
    const status = await requestReceiveSms();
    const granted = status === "granted";
    const next = preferencesFrom(get(), {
      consentGranted: true,
      smsPermission: granted ? "granted" : "denied",
      trackingEnabled: granted,
    });
    await persistPreferences(next);
    set(next);
    await syncCapturedSms(await getDatabase(), next);
  },
  refreshFromPhone: async () => {
    if (!get().ready) return;
    const database = await getDatabase();
    await syncCapturedSms(database, get());
    const snapshot = await loadSnapshot(database);
    set({
      transactions: snapshot.transactions,
      lastSyncAt: snapshot.lastSyncAt,
    });
  },
  updateTransaction: async (id, patch) => {
    const current = get().transactions.find((transaction) => transaction.id === id);
    if (!current) return;
    const next: LedgerTransaction = {
      ...current,
      ...patch,
      id,
      reviewStatus: "user_edited",
    };
    const database = await getDatabase();
    await updateTransactionRecord(database, next);
    set({
      transactions: get().transactions.map((transaction) => (transaction.id === id ? next : transaction)),
    });
  },
  deleteTransaction: async (id) => {
    const database = await getDatabase();
    await deleteTransactionRecord(database, id);
    set({ transactions: get().transactions.filter((transaction) => transaction.id !== id) });
  },
  deleteAllTransactions: async () => {
    const database = await getDatabase();
    await deleteAllRows(database);
    set({ transactions: [] });
  },
  restoreSamples: async () => {
    const database = await getDatabase();
    const transactions = await restoreSampleTransactions(database);
    set({ transactions });
  },
}));

async function hydrateLedger(set: (partial: Partial<LedgerState>) => void): Promise<void> {
  const database = await getDatabase();
  await migrate(database);
  await ensureSampleData(database);
  const snapshot = await loadSnapshot(database);
  await syncCapturedSms(database, snapshot);
  const refreshed = await loadSnapshot(database);
  set({ ...refreshed, ready: true, databaseError: null });
}

async function persistPreferences(preferences: Preferences): Promise<void> {
  const database = await getDatabase();
  await savePreferences(database, preferences);
}

function preferencesFrom(state: LedgerState, patch: Partial<Preferences>): Preferences {
  return {
    onboardingComplete: state.onboardingComplete,
    consentGranted: state.consentGranted,
    trackingEnabled: state.trackingEnabled,
    smsPermission: state.smsPermission,
    ...patch,
  };
}
