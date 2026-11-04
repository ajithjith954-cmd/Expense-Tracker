import { insertTransaction, recordIngestion } from "@/database/repository";
import type { SqlClient } from "@/database/sql";
import { parseSms, PARSER_VERSION, type ParsedDraft } from "@/domain/parse-sms";
import type { ExtractionResponse } from "@/services/extract-transaction";
import type { LedgerTransaction } from "@/types/transaction";

export type IngestResult =
  | { status: "blocked" }
  | { status: "ignored"; reason: "otp" | "not_financial" }
  | { status: "duplicate" }
  | { status: "saved"; transaction: LedgerTransaction; usedGemini: boolean }
  | { status: "incomplete" };

type IngestOptions = {
  consentGranted: boolean;
  trackingEnabled: boolean;
  now?: Date;
  extract?: (message: string) => Promise<ExtractionResponse | null>;
};

export async function ingestFinancialMessage(
  client: SqlClient,
  message: string,
  options: IngestOptions,
): Promise<IngestResult> {
  if (!options.consentGranted || !options.trackingEnabled) return { status: "blocked" };

  const receivedAt = (options.now ?? new Date()).toISOString();
  const fingerprint = await fingerprintMessage(message);
  const recorded = await recordIngestion(client, {
    id: `event-${fingerprint.slice(0, 16)}`,
    messageFingerprint: fingerprint,
    processingStatus: "received",
    parserVersion: PARSER_VERSION,
    errorMessage: null,
    receivedAt,
  });
  if (recorded === "duplicate") return { status: "duplicate" };

  const parsed = parseSms(message);
  if (parsed.kind === "ignore") {
    await mark(client, fingerprint, "ignored", null);
    return { status: "ignored", reason: parsed.reason };
  }

  let draft = parsed.draft;
  let usedGemini = false;
  let method: LedgerTransaction["extractionMethod"] = "deterministic";
  if (parsed.needsGemini && options.extract) {
    const extracted = await options.extract(message);
    if (extracted?.amount) {
      draft = draftFromExtraction(extracted, draft);
      usedGemini = true;
      method = "gemini";
    }
  }

  if (draft.transactionDate === null) {
    const now = options.now ?? new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    draft = { ...draft, transactionDate: `${now.getFullYear()}-${month}-${day}` };
  }

  if (draft.amount === null || draft.transactionDate === null) {
    await mark(client, fingerprint, "failed", "amount or date was missing");
    return { status: "incomplete" };
  }

  const transaction: LedgerTransaction = {
    id: `sms-${fingerprint.slice(0, 16)}`,
    amount: draft.amount,
    merchant: draft.merchant,
    transactionDate: draft.transactionDate,
    transactionTime: draft.transactionTime,
    direction: draft.direction,
    category: draft.category,
    accountIdentifier: draft.accountIdentifier,
    referenceNumber: draft.referenceNumber,
    relatedReference: draft.relatedReference,
    transactionType: draft.transactionType,
    confidence: draft.confidence,
    extractionMethod: method,
    source: "sms",
    reviewStatus: parsed.needsGemini ? "partial" : "auto_saved",
  };
  const inserted = await insertTransaction(client, transaction, receivedAt);
  if (inserted === "duplicate") {
    await mark(client, fingerprint, "duplicate", null);
    return { status: "duplicate" };
  }
  await mark(client, fingerprint, "parsed", null);
  return { status: "saved", transaction, usedGemini };
}

async function mark(
  client: SqlClient,
  fingerprint: string,
  status: "ignored" | "parsed" | "failed" | "duplicate",
  errorMessage: string | null,
): Promise<void> {
  await client.run(
    "UPDATE ingestion_events SET processing_status = ?, error_message = ? WHERE message_fingerprint = ?",
    [status, errorMessage, fingerprint],
  );
}

function draftFromExtraction(extracted: ExtractionResponse, draft: ParsedDraft): ParsedDraft {
  return {
    amount: extracted.amount,
    merchant: extracted.merchant,
    transactionDate: extracted.transactionDate ?? draft.transactionDate,
    transactionTime: extracted.transactionTime ?? draft.transactionTime,
    direction: extracted.direction ?? draft.direction,
    category: extracted.category ?? draft.category,
    accountIdentifier: maskIfFull(extracted.accountIdentifier ?? draft.accountIdentifier),
    referenceNumber: extracted.referenceNumber ?? draft.referenceNumber,
    relatedReference: draft.relatedReference,
    transactionType: extracted.transactionType,
    confidence: extracted.confidence,
  };
}

function maskIfFull(account: string | null): string | null {
  if (!account) return null;
  const digits = account.replace(/[^0-9]/g, "");
  if (digits.length >= 8 && !/[xX*]/.test(account)) return `XX${digits.slice(-4)}`;
  return account;
}

export async function fingerprintMessage(message: string): Promise<string> {
  const text = message.trim();
  try {
    const subtle = globalThis.crypto?.subtle;
    if (subtle) {
      const digest = await subtle.digest("SHA-256", new TextEncoder().encode(text));
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    // Hermes has no crypto global. Fall through to the local hash.
  }
  return sha256(text);
}

function sha256(message: string): string {
  const bytes = unescape(encodeURIComponent(message));
  const words = new Uint32Array(64);
  const hash = Uint32Array.of(0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19);
  const k = Uint32Array.from([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const bitLength = bytes.length * 8;
  const withLength = bytes.length + 1 + ((64 - ((bytes.length + 9) % 64)) % 64) + 8;
  const data = new Uint8Array(withLength);
  for (let index = 0; index < bytes.length; index += 1) data[index] = bytes.charCodeAt(index);
  data[bytes.length] = 0x80;
  const view = new DataView(data.buffer);
  view.setUint32(data.length - 4, bitLength, false);
  for (let offset = 0; offset < data.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotr(words[index - 15], 7) ^ rotr(words[index - 15], 18) ^ (words[index - 15] >>> 3);
      const s1 = rotr(words[index - 2], 17) ^ rotr(words[index - 2], 19) ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + k[index] + words[index]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return [...hash].map((word) => word.toString(16).padStart(8, "0")).join("");
}

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}
