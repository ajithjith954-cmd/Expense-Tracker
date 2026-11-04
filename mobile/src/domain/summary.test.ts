import assert from "node:assert/strict";
import test from "node:test";

import { compareWithPrevious, summarizeMonth } from "./summary.ts";
import type { LedgerTransaction } from "../types/transaction.ts";

function transaction(overrides: Partial<LedgerTransaction>): LedgerTransaction {
  return {
    id: "id",
    amount: 100,
    merchant: "Shop",
    transactionDate: "2026-11-02",
    transactionTime: null,
    direction: "debit",
    category: "Food",
    accountIdentifier: "XX12",
    referenceNumber: null,
    relatedReference: null,
    transactionType: "expense",
    confidence: 1,
    extractionMethod: "manual",
    source: "sample",
    reviewStatus: "auto_saved",
    ...overrides,
  };
}

test("a debit expense counts, and a debit transfer does not", () => {
  const summary = summarizeMonth(
    [
      transaction({ id: "food", amount: 200 }),
      transaction({
        id: "card",
        amount: 5000,
        merchant: "Credit card bill",
        transactionType: "own_account_transfer",
        category: null,
      }),
      transaction({
        id: "self",
        amount: 800,
        transactionType: "own_account_transfer",
        category: null,
      }),
      transaction({ id: "failed", amount: 50, transactionType: "failed" }),
      transaction({ id: "unknown", amount: 70, transactionType: "unknown", direction: "debit" }),
    ],
    "2026-11",
  );

  assert.equal(summary.spent, 200);
  assert.equal(summary.excludedCount, 4);
  assert.deepEqual(summary.categories, [{ name: "Food", amount: 200 }]);
});

test("a linked refund reduces the original category", () => {
  const summary = summarizeMonth(
    [
      transaction({ id: "meal", amount: 486, referenceNumber: "UTR1" }),
      transaction({
        id: "refund",
        amount: 120,
        transactionType: "refund",
        direction: "credit",
        relatedReference: "UTR1",
        category: null,
      }),
    ],
    "2026-11",
  );

  assert.equal(summary.spent, 366);
  assert.deepEqual(summary.categories, [{ name: "Food", amount: 366 }]);
});

test("income is received, and net is received minus spent", () => {
  const summary = summarizeMonth(
    [
      transaction({ id: "pay", amount: 1000, transactionType: "income", direction: "credit", category: null }),
      transaction({ id: "food", amount: 250 }),
    ],
    "2026-11",
  );

  assert.equal(summary.received, 1000);
  assert.equal(summary.spent, 250);
  assert.equal(summary.net, 750);
});

test("comparison stays quiet until both months have enough expenses", () => {
  const thin = compareWithPrevious([transaction({ id: "one" }), transaction({ id: "two" })], "2026-11");
  assert.equal(thin.status, "insufficient");

  const ready = compareWithPrevious(
    [
      transaction({ id: "a", transactionDate: "2026-11-01" }),
      transaction({ id: "b", transactionDate: "2026-11-02" }),
      transaction({ id: "c", transactionDate: "2026-11-03" }),
      transaction({ id: "d", transactionDate: "2026-10-01" }),
      transaction({ id: "e", transactionDate: "2026-10-02" }),
      transaction({ id: "f", transactionDate: "2026-10-03" }),
    ],
    "2026-11",
  );
  assert.equal(ready.status, "ready");
});
