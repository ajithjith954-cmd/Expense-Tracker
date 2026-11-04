import assert from "node:assert/strict";
import test from "node:test";

import { extractionResponseSchema } from "./schema.js";

const validResponse = {
  amount: 1250.5,
  merchant: "Swiggy",
  transactionDate: "2026-11-04",
  transactionTime: "13:45",
  direction: "debit",
  category: "Food",
  accountIdentifier: "XXXX1234",
  referenceNumber: "UTR0001",
  transactionType: "expense",
  confidence: 0.92,
  extractionMethod: "gemini",
};

test("accepts an explicit extraction result", () => {
  const parsed = extractionResponseSchema.parse(validResponse);
  assert.equal(parsed.merchant, "Swiggy");
  assert.equal(parsed.amount, 1250.5);
});

test("accepts unknown facts when they are explicitly null", () => {
  const parsed = extractionResponseSchema.parse({
    ...validResponse,
    merchant: null,
    transactionTime: null,
    referenceNumber: null,
    category: null,
  });
  assert.equal(parsed.merchant, null);
});

test("rejects a result that omits a field", () => {
  const incomplete: Record<string, unknown> = { ...validResponse };
  delete incomplete.merchant;
  const result = extractionResponseSchema.safeParse(incomplete);
  assert.equal(result.success, false);
});

test("rejects a result that adds an unknown field", () => {
  const result = extractionResponseSchema.safeParse({
    ...validResponse,
    note: "invented by the model",
  });
  assert.equal(result.success, false);
});
