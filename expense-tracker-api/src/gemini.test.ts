import assert from "node:assert/strict";
import test from "node:test";

import { extractWithModel, GeminiResponseError, parseExtraction } from "./gemini.js";

const modelJson = `{
  "amount": 486,
  "merchant": "Swiggy",
  "transactionDate": "2026-11-04",
  "transactionTime": "13:45",
  "direction": "debit",
  "category": "Food",
  "accountIdentifier": "XX4291",
  "referenceNumber": "UTR1001",
  "transactionType": "expense",
  "confidence": 0.9
}`;

test("parseExtraction fills the method and keeps explicit nulls", () => {
  const parsed = parseExtraction(modelJson.replace('"Swiggy"', "null"));
  assert.equal(parsed.merchant, null);
  assert.equal(parsed.extractionMethod, "gemini");
  assert.equal(parsed.amount, 486);
});

test("parseExtraction accepts a fenced JSON reply", () => {
  const parsed = parseExtraction("```json\n" + modelJson + "\n```");
  assert.equal(parsed.merchant, "Swiggy");
});

test("parseExtraction rejects a reply that invents a field", () => {
  const invented = modelJson.replace(
    '"confidence": 0.9',
    '"confidence": 0.9, "note": "guessed"',
  );
  assert.throws(() => parseExtraction(invented), GeminiResponseError);
});

test("parseExtraction rejects a guessed empty merchant", () => {
  assert.throws(() => parseExtraction(modelJson.replace('"Swiggy"', '""')), GeminiResponseError);
});

test("extractWithModel sends the message as data and does not call the network", async () => {
  const synthetic =
    "INR 486.00 debited from A/c XX4291 on 04-11-26 at 13:45 for Swiggy. UTR UTR1001.";
  let seen = "";
  const parsed = await extractWithModel(synthetic, {
    async generate(prompt) {
      seen = prompt;
      return modelJson;
    },
  });
  assert.match(seen, /MESSAGE_START/);
  assert.match(seen, new RegExp(synthetic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(parsed.referenceNumber, "UTR1001");
  assert.equal(parsed.extractionMethod, "gemini");
});
