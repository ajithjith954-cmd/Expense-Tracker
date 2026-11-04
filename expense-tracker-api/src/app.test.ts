import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import test from "node:test";

import { createApp } from "./app.js";
import type { ExtractionResponse } from "./schema.js";

const syntheticDebit =
  "INR 486.00 debited from A/c XX4291 on 04-11-26 at 13:45 for Swiggy. UTR UTR1001. Never share OTP.";

const extracted: ExtractionResponse = {
  amount: 486,
  merchant: "Swiggy",
  transactionDate: "2026-11-04",
  transactionTime: "13:45",
  direction: "debit",
  category: "Food",
  accountIdentifier: "XX4291",
  referenceNumber: "UTR1001",
  transactionType: "expense",
  confidence: 0.9,
  extractionMethod: "gemini",
};

async function withServer(
  run: (baseUrl: string) => Promise<void>,
  options?: Parameters<typeof createApp>[0],
): Promise<void> {
  const server: Server = createApp(options).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("Test server did not bind to a port");
  }

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("GET /health reports the extraction service", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body, {
      status: "ok",
      service: "expense-tracker-api",
      phase: 4,
    });
  });
});

test("missing API key does not call Gemini", async () => {
  const previous = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/extract-transaction`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: syntheticDebit }),
      });
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.equal(body.error, "gemini_not_configured");
    });
  } finally {
    if (previous !== undefined) process.env.GEMINI_API_KEY = previous;
  }
});

test("a synthetic debit is returned only after the model reply is valid", async () => {
  let calls = 0;
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/extract-transaction`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: syntheticDebit }),
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.deepEqual(body, extracted);
      assert.equal(calls, 1);
    },
    {
      extract: async (message) => {
        calls += 1;
        assert.equal(message, syntheticDebit);
        return extracted;
      },
    },
  );
});

test("an OTP is not sent to the model", async () => {
  let calls = 0;
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/extract-transaction`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Your OTP is 482193. Do not share it." }),
      });
      assert.equal(response.status, 422);
      const body = await response.json();
      assert.equal(body.error, "not_financial");
      assert.equal(calls, 0);
    },
    {
      extract: async () => {
        calls += 1;
        return extracted;
      },
    },
  );
});

test("a model reply that fails validation is rejected", async () => {
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/extract-transaction`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: syntheticDebit }),
      });
      assert.equal(response.status, 502);
      const body = await response.json();
      assert.equal(body.error, "extraction_invalid");
    },
    {
      extract: async () => ({ ...extracted, merchant: "" }),
    },
  );
});

test("a model outage is reported without the message body", async () => {
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/extract-transaction`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: syntheticDebit }),
      });
      assert.equal(response.status, 502);
      const body = await response.json();
      assert.equal(body.error, "extraction_failed");
      assert.equal(JSON.stringify(body).includes("Swiggy"), false);
    },
    {
      extract: async () => {
        throw new Error(`network failed for ${syntheticDebit}`);
      },
    },
  );
});

test("repeated extraction is throttled", async () => {
  await withServer(
    async (baseUrl) => {
      const send = () =>
        fetch(`${baseUrl}/api/extract-transaction`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: syntheticDebit }),
        });
      assert.equal((await send()).status, 200);
      assert.equal((await send()).status, 200);
      const limited = await send();
      assert.equal(limited.status, 429);
      assert.equal(limited.headers.get("retry-after"), "60");
    },
    {
      extract: async () => extracted,
      rateLimit: { limit: 2, windowMs: 60_000 },
    },
  );
});

test("malformed JSON is rejected", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/extract-transaction`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, "invalid_json");
  });
});

test("a request without a message is rejected", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/extract-transaction`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: "missing message" }),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, "invalid_request");
  });
});
