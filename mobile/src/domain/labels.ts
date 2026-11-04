import type { LedgerTransaction, TransactionType } from "@/types/transaction";

import { UNCATEGORIZED } from "./summary";

const TYPE_LABELS: Record<TransactionType, string> = {
  expense: "Expense",
  income: "Income",
  own_account_transfer: "Transfer",
  refund: "Refund",
  reversal: "Reversal",
  failed: "Failed",
  unknown: "Unknown",
};

export function typeLabel(type: TransactionType): string {
  return TYPE_LABELS[type];
}

export function merchantLabel(transaction: Pick<LedgerTransaction, "merchant">): string {
  return transaction.merchant ?? "Unknown merchant";
}

export function categoryLabel(category: string | null): string {
  return category ?? UNCATEGORIZED;
}

export function countsAsSpending(transaction: LedgerTransaction): boolean {
  return transaction.transactionType === "expense" && transaction.direction === "debit";
}

export function exclusionLabel(transaction: LedgerTransaction): string | null {
  if (transaction.transactionType === "own_account_transfer") return "Not spending";
  if (transaction.transactionType === "failed") return "Not completed";
  if (transaction.transactionType === "unknown") return "Not classified";
  if (transaction.transactionType === "refund" || transaction.transactionType === "reversal") {
    return "Adjusts spending";
  }
  return null;
}
