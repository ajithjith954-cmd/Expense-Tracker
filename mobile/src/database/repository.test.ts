import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { SAMPLE_TRANSACTIONS } from "../domain/samples.ts";
import {
  deleteAllTransactions,
  ensureSampleData,
  findByReference,
  insertTransaction,
  loadSnapshot,
  migrate,
  recordIngestion,
  restoreSampleTransactions,
  savePreferences,
  updateTransactionRecord,
} from "./repository.ts";
import type { SqlClient } from "./sql.ts";

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

test("migration seeds samples once and keeps an edit after a second open", async () => {
  const client = memoryClient();
  await migrate(client);
  await ensureSampleData(client, "2026-11-04T00:00:00.000Z");
  await migrate(client);
  await ensureSampleData(client, "2026-11-04T00:00:00.000Z");

  const first = await loadSnapshot(client);
  assert.equal(first.transactions.length, SAMPLE_TRANSACTIONS.length);
  assert.equal(first.onboardingComplete, false);

  const edited = {
    ...first.transactions.find((transaction) => transaction.id === "nov-pharmacy")!,
    merchant: "Apollo edited",
    reviewStatus: "user_edited" as const,
  };
  await updateTransactionRecord(client, edited, "2026-11-04T01:00:00.000Z");
  await savePreferences(client, {
    onboardingComplete: true,
    consentGranted: true,
    trackingEnabled: false,
    smsPermission: "undetermined",
  });

  const second = await loadSnapshot(client);
  assert.equal(second.onboardingComplete, true);
  assert.equal(second.transactions.find((transaction) => transaction.id === "nov-pharmacy")?.merchant, "Apollo edited");
});

test("a repeated reference is a duplicate and is not inserted", async () => {
  const client = memoryClient();
  await migrate(client);
  const original = SAMPLE_TRANSACTIONS[1];
  assert.equal(await insertTransaction(client, original), "inserted");
  assert.equal(
    await insertTransaction(client, { ...original, id: "another-id" }),
    "duplicate",
  );
  assert.equal((await findByReference(client, original.referenceNumber!))?.id, original.id);
  const snapshot = await loadSnapshot(client);
  assert.equal(snapshot.transactions.length, 1);
});

test("deleting transactions does not bring the samples back, and restore does", async () => {
  const client = memoryClient();
  await migrate(client);
  await ensureSampleData(client);
  await deleteAllTransactions(client);
  await ensureSampleData(client);
  assert.equal((await loadSnapshot(client)).transactions.length, 0);

  const restored = await restoreSampleTransactions(client);
  assert.equal(restored.length, SAMPLE_TRANSACTIONS.length);
  assert.equal((await loadSnapshot(client)).transactions.length, SAMPLE_TRANSACTIONS.length);
});

test("the same message fingerprint is recorded once", async () => {
  const client = memoryClient();
  await migrate(client);
  const event = {
    id: "event-1",
    messageFingerprint: "abc123",
    processingStatus: "parsed" as const,
    parserVersion: "0",
    errorMessage: null,
    receivedAt: "2026-11-04T00:00:00.000Z",
  };
  assert.equal(await recordIngestion(client, event), "recorded");
  assert.equal(await recordIngestion(client, { ...event, id: "event-2" }), "duplicate");
});

test("a card payment sample is stored and is not an expense type", async () => {
  const client = memoryClient();
  await migrate(client);
  await ensureSampleData(client);
  const card = (await loadSnapshot(client)).transactions.find((transaction) => transaction.id === "nov-card");
  assert.equal(card?.transactionType, "own_account_transfer");
  assert.equal(card?.accountIdentifier, "XX4291");
});
