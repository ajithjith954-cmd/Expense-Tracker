export type SqlValue = string | number | null;

export type SqlClient = {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
};

export const APP_DATABASE_NAME = "expense-tracker.db";

export const SCHEMA_VERSION = 1;

export const MIGRATION_V1 = [
  `CREATE TABLE categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    icon TEXT NOT NULL,
    category_type TEXT NOT NULL CHECK (category_type IN ('expense', 'income', 'transfer'))
  )`,
  `CREATE TABLE accounts (
    id TEXT PRIMARY KEY NOT NULL,
    bank_name TEXT NOT NULL,
    masked_account_identifier TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('savings', 'current', 'credit_card', 'wallet')),
    UNIQUE (bank_name, masked_account_identifier)
  )`,
  `CREATE TABLE transactions (
    id TEXT PRIMARY KEY NOT NULL,
    amount REAL NOT NULL CHECK (amount > 0),
    merchant TEXT,
    category TEXT,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
      'expense', 'income', 'own_account_transfer', 'refund', 'reversal', 'failed', 'unknown'
    )),
    transaction_date TEXT NOT NULL,
    transaction_time TEXT,
    direction TEXT CHECK (direction IN ('debit', 'credit')),
    account_identifier TEXT,
    reference_number TEXT,
    related_reference TEXT,
    source TEXT NOT NULL CHECK (source IN ('sample', 'sms')),
    extraction_method TEXT NOT NULL CHECK (extraction_method IN ('deterministic', 'gemini', 'manual')),
    confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    review_status TEXT NOT NULL CHECK (review_status IN ('auto_saved', 'partial', 'user_edited')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX idx_transactions_date ON transactions (transaction_date)`,
  `CREATE INDEX idx_transactions_type ON transactions (transaction_type)`,
  `CREATE INDEX idx_transactions_account ON transactions (account_identifier)`,
  `CREATE UNIQUE INDEX idx_transactions_reference ON transactions (reference_number) WHERE reference_number IS NOT NULL`,
  `CREATE TABLE ingestion_events (
    id TEXT PRIMARY KEY NOT NULL,
    message_fingerprint TEXT NOT NULL UNIQUE,
    processing_status TEXT NOT NULL CHECK (processing_status IN (
      'received', 'ignored', 'parsed', 'failed', 'duplicate'
    )),
    parser_version TEXT NOT NULL,
    error_message TEXT,
    received_at TEXT NOT NULL
  )`,
  `CREATE TABLE app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  )`,
];
