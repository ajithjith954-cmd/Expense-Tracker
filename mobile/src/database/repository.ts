import { SAMPLE_TRANSACTIONS } from "@/domain/samples";
import type {
  ExtractionMethod,
  LedgerTransaction,
  MoneyDirection,
  ReviewStatus,
  SmsPermissionStatus,
  TransactionType,
} from "@/types/transaction";

import { MIGRATION_V1, SCHEMA_VERSION, type SqlClient, type SqlValue } from "./sql";

export type LedgerSnapshot = {
  onboardingComplete: boolean;
  consentGranted: boolean;
  trackingEnabled: boolean;
  smsPermission: SmsPermissionStatus;
  lastSyncAt: string | null;
  transactions: LedgerTransaction[];
};

type TransactionRow = {
  id: string;
  amount: number;
  merchant: string | null;
  category: string | null;
  transaction_type: TransactionType;
  transaction_date: string;
  transaction_time: string | null;
  direction: MoneyDirection | null;
  account_identifier: string | null;
  reference_number: string | null;
  related_reference: string | null;
  source: LedgerTransaction["source"];
  extraction_method: ExtractionMethod;
  confidence: number;
  review_status: ReviewStatus;
};

const CATEGORIES = [
  ["food", "Food", "restaurant", "expense"],
  ["transport", "Transport", "directions-transit", "expense"],
  ["health", "Health", "local-hospital", "expense"],
  ["groceries", "Groceries", "shopping-basket", "expense"],
  ["housing", "Housing", "home", "expense"],
  ["bills", "Bills", "receipt-long", "expense"],
  ["shopping", "Shopping", "shopping-bag", "expense"],
  ["uncategorized", "Uncategorized", "help-outline", "expense"],
] as const;

export async function migrate(client: SqlClient): Promise<void> {
  await client.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    )`,
  );
  const current = await client.get<{ version: number | null }>(
    "SELECT MAX(version) AS version FROM schema_migrations",
  );
  const version = current?.version ?? 0;
  if (version >= SCHEMA_VERSION) return;

  for (const statement of MIGRATION_V1) {
    await client.exec(statement);
  }
  await client.run("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", [
    SCHEMA_VERSION,
    new Date().toISOString(),
  ]);
}

export async function ensureSampleData(client: SqlClient, now = new Date().toISOString()): Promise<void> {
  for (const category of CATEGORIES) {
    await client.run(
      `INSERT INTO categories (id, name, icon, category_type)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
      [...category],
    );
  }
  await client.run(
    `INSERT INTO accounts (id, bank_name, masked_account_identifier, account_type)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(bank_name, masked_account_identifier) DO NOTHING`,
    ["sample-hdfc", "HDFC Bank", "XX4291", "savings"],
  );

  const seeded = await getSetting(client, "samples_seeded");
  if (seeded === "1") return;

  for (const transaction of SAMPLE_TRANSACTIONS) {
    await insertTransaction(client, transaction, now);
  }
  await setSetting(client, "samples_seeded", "1");
}

export async function loadSnapshot(client: SqlClient): Promise<LedgerSnapshot> {
  const rows = await client.all<TransactionRow>(
    `SELECT id, amount, merchant, category, transaction_type, transaction_date, transaction_time,
            direction, account_identifier, reference_number, related_reference, source,
            extraction_method, confidence, review_status
     FROM transactions
     ORDER BY transaction_date DESC, id DESC`,
  );
  const permission = await getSetting(client, "sms_permission");

  return {
    onboardingComplete: (await getSetting(client, "onboarding_complete")) === "1",
    consentGranted: (await getSetting(client, "consent_granted")) === "1",
    trackingEnabled: (await getSetting(client, "tracking_enabled")) === "1",
    smsPermission: isPermission(permission) ? permission : "undetermined",
    lastSyncAt: await getSetting(client, "last_sync"),
    transactions: rows.map(toTransaction),
  };
}

export async function savePreferences(
  client: SqlClient,
  preferences: Omit<LedgerSnapshot, "transactions" | "lastSyncAt">,
): Promise<void> {
  await setSetting(client, "onboarding_complete", preferences.onboardingComplete ? "1" : "0");
  await setSetting(client, "consent_granted", preferences.consentGranted ? "1" : "0");
  await setSetting(client, "tracking_enabled", preferences.trackingEnabled ? "1" : "0");
  await setSetting(client, "sms_permission", preferences.smsPermission);
}

export async function markSynced(client: SqlClient, at: string): Promise<void> {
  await setSetting(client, "last_sync", at);
}

export async function insertTransaction(
  client: SqlClient,
  transaction: LedgerTransaction,
  now = new Date().toISOString(),
): Promise<"inserted" | "duplicate"> {
  if (transaction.referenceNumber) {
    const existing = await findByReference(client, transaction.referenceNumber);
    if (existing && existing.id !== transaction.id) return "duplicate";
  }
  await client.run(
    `INSERT INTO transactions (
      id, amount, merchant, category, transaction_type, transaction_date, transaction_time,
      direction, account_identifier, reference_number, related_reference, source,
      extraction_method, confidence, review_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    transactionParams(transaction, now, now),
  );
  return "inserted";
}

export async function updateTransactionRecord(
  client: SqlClient,
  transaction: LedgerTransaction,
  now = new Date().toISOString(),
): Promise<void> {
  await client.run(
    `UPDATE transactions SET
      amount = ?, merchant = ?, category = ?, transaction_type = ?, transaction_date = ?,
      transaction_time = ?, direction = ?, account_identifier = ?, reference_number = ?,
      related_reference = ?, source = ?, extraction_method = ?, confidence = ?,
      review_status = ?, updated_at = ?
     WHERE id = ?`,
    [
      transaction.amount,
      transaction.merchant,
      transaction.category,
      transaction.transactionType,
      transaction.transactionDate,
      transaction.transactionTime,
      transaction.direction,
      transaction.accountIdentifier,
      transaction.referenceNumber,
      transaction.relatedReference,
      transaction.source,
      transaction.extractionMethod,
      transaction.confidence,
      transaction.reviewStatus,
      now,
      transaction.id,
    ],
  );
}

export async function deleteTransactionRecord(client: SqlClient, id: string): Promise<void> {
  await client.run("DELETE FROM transactions WHERE id = ?", [id]);
}

export async function deleteAllTransactions(client: SqlClient): Promise<void> {
  await client.exec("DELETE FROM transactions");
}

export async function restoreSampleTransactions(
  client: SqlClient,
  now = new Date().toISOString(),
): Promise<LedgerTransaction[]> {
  await deleteAllTransactions(client);
  for (const transaction of SAMPLE_TRANSACTIONS) {
    await insertTransaction(client, { ...transaction }, now);
  }
  return SAMPLE_TRANSACTIONS.map((transaction) => ({ ...transaction }));
}

export async function findByReference(
  client: SqlClient,
  referenceNumber: string,
): Promise<LedgerTransaction | null> {
  const row = await client.get<TransactionRow>(
    `SELECT id, amount, merchant, category, transaction_type, transaction_date, transaction_time,
            direction, account_identifier, reference_number, related_reference, source,
            extraction_method, confidence, review_status
     FROM transactions WHERE reference_number = ?`,
    [referenceNumber],
  );
  return row ? toTransaction(row) : null;
}

export async function recordIngestion(
  client: SqlClient,
  event: {
    id: string;
    messageFingerprint: string;
    processingStatus: "received" | "ignored" | "parsed" | "failed" | "duplicate";
    parserVersion: string;
    errorMessage: string | null;
    receivedAt: string;
  },
): Promise<"recorded" | "duplicate"> {
  const existing = await client.get<{ id: string }>(
    "SELECT id FROM ingestion_events WHERE message_fingerprint = ?",
    [event.messageFingerprint],
  );
  if (existing) return "duplicate";
  await client.run(
    `INSERT INTO ingestion_events (
      id, message_fingerprint, processing_status, parser_version, error_message, received_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      event.id,
      event.messageFingerprint,
      event.processingStatus,
      event.parserVersion,
      event.errorMessage,
      event.receivedAt,
    ],
  );
  return "recorded";
}

function transactionParams(transaction: LedgerTransaction, createdAt: string, updatedAt: string): SqlValue[] {
  return [
    transaction.id,
    transaction.amount,
    transaction.merchant,
    transaction.category,
    transaction.transactionType,
    transaction.transactionDate,
    transaction.transactionTime,
    transaction.direction,
    transaction.accountIdentifier,
    transaction.referenceNumber,
    transaction.relatedReference,
    transaction.source,
    transaction.extractionMethod,
    transaction.confidence,
    transaction.reviewStatus,
    createdAt,
    updatedAt,
  ];
}

function toTransaction(row: TransactionRow): LedgerTransaction {
  return {
    id: row.id,
    amount: row.amount,
    merchant: row.merchant,
    category: row.category,
    transactionType: row.transaction_type,
    transactionDate: row.transaction_date,
    transactionTime: row.transaction_time,
    direction: row.direction,
    accountIdentifier: row.account_identifier,
    referenceNumber: row.reference_number,
    relatedReference: row.related_reference,
    source: row.source,
    extractionMethod: row.extraction_method,
    confidence: row.confidence,
    reviewStatus: row.review_status,
  };
}

async function getSetting(client: SqlClient, key: string): Promise<string | null> {
  const row = await client.get<{ value: string }>("SELECT value FROM app_settings WHERE key = ?", [key]);
  return row?.value ?? null;
}

async function setSetting(client: SqlClient, key: string, value: string): Promise<void> {
  await client.run(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

function isPermission(value: string | null): value is SmsPermissionStatus {
  return value === "undetermined" || value === "granted" || value === "denied" || value === "revoked";
}
