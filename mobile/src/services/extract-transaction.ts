export type ExtractionResponse = {
  amount: number | null;
  merchant: string | null;
  transactionDate: string | null;
  transactionTime: string | null;
  direction: "debit" | "credit" | null;
  category: string | null;
  accountIdentifier: string | null;
  referenceNumber: string | null;
  transactionType:
    | "expense"
    | "income"
    | "own_account_transfer"
    | "refund"
    | "reversal"
    | "failed"
    | "unknown";
  confidence: number;
  extractionMethod: "gemini";
};

export async function extractTransaction(
  message: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ExtractionResponse | null> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
  try {
    const response = await fetchImpl(`${baseUrl}/api/extract-transaction`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!isExtraction(body)) return null;
    return body;
  } catch {
    return null;
  }
}

function isExtraction(value: unknown): value is ExtractionResponse {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    (typeof record.amount === "number" || record.amount === null) &&
    typeof record.transactionType === "string" &&
    typeof record.confidence === "number" &&
    record.extractionMethod === "gemini"
  );
}
