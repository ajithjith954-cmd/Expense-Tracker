import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import type { SqlClient } from "../database/sql.ts";
import { migrate } from "../database/repository.ts";
import { ingestFinancialMessage } from "./ingest.ts";
import type { ExtractionResponse } from "../services/extract-transaction.ts";

function memoryClient(): SqlClient {
  const database = new DatabaseSync(":memory:");
  return {
    async exec(sql) {
      database.exec(sql);
    },
    async run(sql, params = []) {
      database.prepare(sql).run(...params);
    },
    async all(sql, params = []) {
      return database.prepare(sql).all(...params) as never[];
    },
    async get(sql, params = []) {
      return (database.prepare(sql).get(...params) as never) ?? null;
    },
  };
}

const debit = "INR 486.00 debited from A/c XX4291 on 04-11-26 at 13:45 for Swiggy. UTR UTR1001.";
const partial = "INR 250.00 debited from A/c XX4291 on 04-11-26. Ref UTR2509.";

const geminiReply: ExtractionResponse = {
  amount: 250,
  merchant: "Local Store",
  transactionDate: "2026-11-04",
  transactionTime: null,
  direction: "debit",
  category: "Shopping",
  accountIdentifier: "XX4291",
  referenceNumber: "UTR2509",
  transactionType: "expense",
  confidence: 0.8,
  extractionMethod: "gemini",
};

test("tracking that is off does not store the message", async () => {
  const client = memoryClient();
  await migrate(client);
  const result = await ingestFinancialMessage(client, debit, {
    consentGranted: true,
    trackingEnabled: false,
  });
  assert.equal(result.status, "blocked");
  const row = await client.get<{ count: number }>("SELECT COUNT(*) AS count FROM ingestion_events");
  assert.equal(row?.count, 0);
});

test("an OTP is not saved and is not sent to Gemini", async () => {
  const client = memoryClient();
  await migrate(client);
  let calls = 0;
  const result = await ingestFinancialMessage(client, "Your OTP is 482193. Do not share it.", {
    consentGranted: true,
    trackingEnabled: true,
    extract: async () => {
      calls += 1;
      return geminiReply;
    },
  });
  assert.deepEqual(result, { status: "ignored", reason: "otp" });
  assert.equal(calls, 0);
  const saved = await client.get<{ count: number }>("SELECT COUNT(*) AS count FROM transactions");
  assert.equal(saved?.count, 0);
});

test("a known debit is saved once and the raw message is not stored", async () => {
  const client = memoryClient();
  await migrate(client);
  const first = await ingestFinancialMessage(client, debit, {
    consentGranted: true,
    trackingEnabled: true,
    now: new Date("2026-11-04T08:15:00.000Z"),
  });
  const second = await ingestFinancialMessage(client, debit, {
    consentGranted: true,
    trackingEnabled: true,
  });
  assert.equal(first.status, "saved");
  if (first.status !== "saved") return;
  assert.equal(first.usedGemini, false);
  assert.equal(first.transaction.merchant, "Swiggy");
  assert.equal(first.transaction.source, "sms");
  assert.equal(second.status, "duplicate");
  const rows = await client.all<{ message_fingerprint: string; error_message: string | null }>(
    "SELECT message_fingerprint, error_message FROM ingestion_events",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.error_message, null);
  assert.equal(JSON.stringify(rows).includes("Swiggy"), false);
});

test("an unfamiliar debit uses Gemini once, and a failed call still keeps the known fields", async () => {
  const client = memoryClient();
  await migrate(client);
  let calls = 0;
  const saved = await ingestFinancialMessage(client, partial, {
    consentGranted: true,
    trackingEnabled: true,
    extract: async () => {
      calls += 1;
      return geminiReply;
    },
  });
  assert.equal(saved.status, "saved");
  if (saved.status !== "saved") return;
  assert.equal(saved.usedGemini, true);
  assert.equal(saved.transaction.merchant, "Local Store");
  assert.equal(calls, 1);

  const other = memoryClient();
  await migrate(other);
  const fallback = await ingestFinancialMessage(other, partial, {
    consentGranted: true,
    trackingEnabled: true,
    extract: async () => null,
  });
  assert.equal(fallback.status, "saved");
  if (fallback.status !== "saved") return;
  assert.equal(fallback.usedGemini, false);
  assert.equal(fallback.transaction.merchant, null);
  assert.equal(fallback.transaction.reviewStatus, "partial");
});
