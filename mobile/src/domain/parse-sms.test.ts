import assert from "node:assert/strict";
import test from "node:test";

import { parseSms } from "./parse-sms.ts";

test("a known debit becomes an expense without Gemini", () => {
  const result = parseSms(
    "INR 486.00 debited from A/c XX4291 on 04-11-26 at 13:45 for Swiggy. UTR UTR1001.",
  );
  assert.equal(result.kind, "parsed");
  if (result.kind !== "parsed") return;
  assert.equal(result.needsGemini, false);
  assert.equal(result.draft.amount, 486);
  assert.equal(result.draft.merchant, "Swiggy");
  assert.equal(result.draft.category, "Food");
  assert.equal(result.draft.transactionType, "expense");
  assert.equal(result.draft.direction, "debit");
  assert.equal(result.draft.accountIdentifier, "XX4291");
  assert.equal(result.draft.transactionDate, "2026-11-04");
  assert.equal(result.draft.transactionTime, "13:45:00");
  assert.equal(result.draft.referenceNumber, "UTR1001");
});

test("a credit-card bill is a transfer, not an expense", () => {
  const result = parseSms(
    "INR 4200.00 paid towards HDFC Credit Card XX9912 from A/c XX4291 on 02-11-26. Ref CCBILL1103.",
  );
  assert.equal(result.kind, "parsed");
  if (result.kind !== "parsed") return;
  assert.equal(result.draft.transactionType, "own_account_transfer");
  assert.equal(result.needsGemini, false);
  assert.equal(result.draft.referenceNumber, "CCBILL1103");
});

test("a transfer between the user's accounts is not spending", () => {
  const result = parseSms(
    "INR 15000.00 transferred from A/c XX4291 to your A/c XX8831 on 02-11-26. Ref IMPS2201.",
  );
  assert.equal(result.kind, "parsed");
  if (result.kind !== "parsed") return;
  assert.equal(result.draft.transactionType, "own_account_transfer");
  assert.equal(result.draft.direction, "debit");
});

test("a failed payment is not a completed expense", () => {
  const result = parseSms(
    "Payment of INR 299 to Airtel from A/c XX4291 failed on 03-11-26. Ref FAIL200.",
  );
  assert.equal(result.kind, "parsed");
  if (result.kind !== "parsed") return;
  assert.equal(result.draft.transactionType, "failed");
  assert.equal(result.draft.merchant, "Airtel");
  assert.equal(result.needsGemini, false);
});

test("a refund keeps its own reference and the original reference", () => {
  const result = parseSms(
    "INR 120.00 credited to A/c XX4291 on 04-11-26. Refund from Swiggy against UTR1001. Ref REF1001.",
  );
  assert.equal(result.kind, "parsed");
  if (result.kind !== "parsed") return;
  assert.equal(result.draft.transactionType, "refund");
  assert.equal(result.draft.direction, "credit");
  assert.equal(result.draft.referenceNumber, "REF1001");
  assert.equal(result.draft.relatedReference, "UTR1001");
});

test("salary is income", () => {
  const result = parseSms(
    "INR 82,000.00 credited to A/c XX4291 on 01-11-26 at 09:15. Info: SALARY Northwind Labs. Ref SAL1126.",
  );
  assert.equal(result.kind, "parsed");
  if (result.kind !== "parsed") return;
  assert.equal(result.draft.transactionType, "income");
  assert.equal(result.draft.amount, 82000);
  assert.equal(result.draft.merchant, "Northwind Labs");
});

test("a debit with no merchant needs Gemini and is not guessed", () => {
  const result = parseSms("INR 250.00 debited from A/c XX4291 on 04-11-26. Ref UTR2509.");
  assert.equal(result.kind, "parsed");
  if (result.kind !== "parsed") return;
  assert.equal(result.needsGemini, true);
  assert.equal(result.draft.merchant, null);
  assert.equal(result.draft.category, null);
});

test("a full account number is stored only as a mask", () => {
  const result = parseSms(
    "INR 10.00 debited from A/c 123456789012 on 04-11-26 for Cafe. Ref CAFE1001.",
  );
  assert.equal(result.kind, "parsed");
  if (result.kind !== "parsed") return;
  assert.equal(result.draft.accountIdentifier, "XX9012");
});

test("a DBS credit dated 04-Nov-2026 is income", () => {
  const result = parseSms(
    "Dear Customer, your DBS account no XXXXXXXXXXXX5744 is credited with INR 20.00 on 04-Nov-2026 and is subject to clearance.",
  );
  assert.equal(result.kind, "parsed");
  if (result.kind !== "parsed") return;
  assert.equal(result.needsGemini, false);
  assert.equal(result.draft.amount, 20);
  assert.equal(result.draft.transactionType, "income");
  assert.equal(result.draft.direction, "credit");
  assert.equal(result.draft.transactionDate, "2026-11-04");
  assert.equal(result.draft.merchant, null);
});

test("a debit that also says the other person was credited stays an expense", () => {
  const result = parseSms(
    "ICICI Bank Acct XX1234 debited for Rs 20.00 on 04-Nov-26; Meera K credited. UPI:123456789012. Call 1800 for dispute.",
  );
  assert.equal(result.kind, "parsed");
  if (result.kind !== "parsed") return;
  assert.equal(result.draft.transactionType, "expense");
  assert.equal(result.draft.direction, "debit");
  assert.equal(result.draft.amount, 20);
  assert.equal(result.draft.transactionDate, "2026-11-04");
  assert.equal(result.draft.merchant, "Meera K");
});

test("an OTP is ignored", () => {
  assert.deepEqual(parseSms("Your OTP is 482193. Do not share it."), {
    kind: "ignore",
    reason: "otp",
  });
});

test("a message that is not a payment is ignored", () => {
  assert.deepEqual(parseSms("XX4291 notice: please visit the branch."), {
    kind: "ignore",
    reason: "not_financial",
  });
});
