/**
 * Shared transaction shape. Field names match the API extraction contract in
 * expense-tracker-api/src/schema.ts. Parsing does not exist yet.
 */
export const TRANSACTION_TYPES = [
  "expense",
  "income",
  "own_account_transfer",
  "refund",
  "reversal",
  "failed",
  "unknown",
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export type MoneyDirection = "debit" | "credit";

export type ExtractionMethod = "deterministic" | "gemini" | "manual";

export type TransactionDraft = {
  amount: number | null;
  merchant: string | null;
  transactionDate: string | null;
  transactionTime: string | null;
  direction: MoneyDirection | null;
  category: string | null;
  accountIdentifier: string | null;
  referenceNumber: string | null;
  transactionType: TransactionType;
  confidence: number;
  extractionMethod: ExtractionMethod;
};

export type ReviewStatus = "auto_saved" | "partial" | "user_edited";

export type SmsPermissionStatus = "undetermined" | "granted" | "denied" | "revoked";

export type LedgerTransaction = {
  id: string;
  amount: number;
  merchant: string | null;
  transactionDate: string;
  transactionTime: string | null;
  direction: MoneyDirection | null;
  category: string | null;
  accountIdentifier: string | null;
  referenceNumber: string | null;
  relatedReference: string | null;
  transactionType: TransactionType;
  confidence: number;
  extractionMethod: ExtractionMethod;
  source: "sample" | "sms";
  reviewStatus: ReviewStatus;
};
