import type { LedgerTransaction } from "@/types/transaction";

export const UNCATEGORIZED = "Uncategorized";

export type CategoryTotal = {
  name: string;
  amount: number;
};

export type MonthSummary = {
  month: string;
  spent: number;
  received: number;
  net: number;
  expenseCount: number;
  excludedCount: number;
  categories: CategoryTotal[];
  highest: CategoryTotal | null;
};

export type MonthComparison =
  | { status: "insufficient"; current: MonthSummary; previous: MonthSummary }
  | {
      status: "ready";
      current: MonthSummary;
      previous: MonthSummary;
      difference: number;
    };

const MINIMUM_EXPENSES_FOR_COMPARISON = 3;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function inMonth(transaction: LedgerTransaction, month: string): boolean {
  return transaction.transactionDate.startsWith(`${month}-`) || transaction.transactionDate === month;
}

export function summarizeMonth(transactions: LedgerTransaction[], month: string): MonthSummary {
  const rows = transactions.filter((transaction) => inMonth(transaction, month));
  const expenses = rows.filter(
    (transaction) => transaction.transactionType === "expense" && transaction.direction === "debit",
  );
  const income = rows.filter(
    (transaction) => transaction.transactionType === "income" && transaction.direction === "credit",
  );
  const adjustments = rows.filter(
    (transaction) =>
      transaction.transactionType === "refund" || transaction.transactionType === "reversal",
  );
  const excludedCount = rows.filter(
    (transaction) =>
      transaction.transactionType === "own_account_transfer" ||
      transaction.transactionType === "failed" ||
      transaction.transactionType === "unknown",
  ).length;

  const byCategory = new Map<string, number>();
  for (const transaction of expenses) {
    const name = transaction.category ?? UNCATEGORIZED;
    byCategory.set(name, (byCategory.get(name) ?? 0) + transaction.amount);
  }

  let unallocatedAdjustment = 0;
  for (const transaction of adjustments) {
    const match = transaction.relatedReference
      ? expenses.find((expense) => expense.referenceNumber === transaction.relatedReference)
      : undefined;
    if (!match) {
      unallocatedAdjustment += transaction.amount;
      continue;
    }
    const name = match.category ?? UNCATEGORIZED;
    const current = byCategory.get(name) ?? 0;
    const applied = Math.min(current, transaction.amount);
    byCategory.set(name, current - applied);
    unallocatedAdjustment += transaction.amount - applied;
  }

  const categories = [...byCategory.entries()]
    .map(([name, amount]) => ({ name, amount: roundMoney(amount) }))
    .filter((category) => category.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  const categorySpent = categories.reduce((sum, category) => sum + category.amount, 0);
  const spent = roundMoney(categorySpent - unallocatedAdjustment);
  const received = roundMoney(income.reduce((sum, transaction) => sum + transaction.amount, 0));

  return {
    month,
    spent,
    received,
    net: roundMoney(received - spent),
    expenseCount: expenses.length,
    excludedCount,
    categories,
    highest: categories[0] ?? null,
  };
}

export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function previousMonth(month: string): string {
  const [yearText, monthText] = month.split("-");
  const date = new Date(Number(yearText), Number(monthText) - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function compareWithPrevious(
  transactions: LedgerTransaction[],
  month: string,
): MonthComparison {
  const current = summarizeMonth(transactions, month);
  const previous = summarizeMonth(transactions, previousMonth(month));
  if (
    current.expenseCount < MINIMUM_EXPENSES_FOR_COMPARISON ||
    previous.expenseCount < MINIMUM_EXPENSES_FOR_COMPARISON
  ) {
    return { status: "insufficient", current, previous };
  }
  return {
    status: "ready",
    current,
    previous,
    difference: roundMoney(current.spent - previous.spent),
  };
}

export function monthsWithActivity(transactions: LedgerTransaction[]): string[] {
  return [...new Set(transactions.map((transaction) => transaction.transactionDate.slice(0, 7)))].sort();
}
