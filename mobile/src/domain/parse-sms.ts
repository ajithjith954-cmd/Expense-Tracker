import type { MoneyDirection, TransactionType } from "@/types/transaction";

export const PARSER_VERSION = "5";

export type ParsedDraft = {
  amount: number | null;
  merchant: string | null;
  transactionDate: string | null;
  transactionTime: string | null;
  direction: MoneyDirection | null;
  category: string | null;
  accountIdentifier: string | null;
  referenceNumber: string | null;
  relatedReference: string | null;
  transactionType: TransactionType;
  confidence: number;
};

export type ParseOutcome =
  | { kind: "ignore"; reason: "otp" | "not_financial" }
  | { kind: "parsed"; draft: ParsedDraft; needsGemini: boolean };

const OTP = /\b(otp|one[ -]?time password|verification code)\b/i;
const FINANCIAL =
  /\b(debited|credited|spent|received|transferred|transfer|payment|paid|refund|reversal|reversed|failed|declined|unsuccessful)\b|₹|\binr\b|\brs\.?/i;

const CATEGORIES: { name: string; pattern: RegExp }[] = [
  { name: "Food", pattern: /\b(swiggy|zomato|restaurant|cafe)\b/i },
  { name: "Transport", pattern: /\b(uber|ola|metro|irctc|rapido)\b/i },
  { name: "Health", pattern: /\b(apollo|pharmacy|hospital|medical)\b/i },
  { name: "Groceries", pattern: /\b(bigbasket|blinkit|zepto|grocer)\b/i },
  { name: "Housing", pattern: /\b(rent|landlord|society)\b/i },
  { name: "Bills", pattern: /\b(airtel|jio|vi|bses|electricity|recharge|bill)\b/i },
  { name: "Shopping", pattern: /\b(amazon|flipkart|myntra)\b/i },
];

export function parseSms(message: string): ParseOutcome {
  const text = message.replace(/\s+/g, " ").trim();
  if (!text) return { kind: "ignore", reason: "not_financial" };
  if (OTP.test(text) && !FINANCIAL.test(text)) return { kind: "ignore", reason: "otp" };
  if (!FINANCIAL.test(text)) return { kind: "ignore", reason: "not_financial" };

  const transactionType = classify(text);
  const direction = directionFor(text, transactionType);
  const amount = readAmount(text);
  const accountIdentifier = readAccount(text);
  const referenceNumber = readReference(text);
  const relatedReference = readRelatedReference(text);
  const merchant = readMerchant(text);
  const transactionDate = readDate(text);
  const transactionTime = readTime(text);
  const category = transactionType === "expense" ? categoryFor(merchant) : null;
  const confidence = score({
    amount,
    transactionType,
    accountIdentifier,
    transactionDate,
    merchant,
    referenceNumber,
  });
  const needsGemini =
    transactionType === "unknown" || amount === null || (transactionType === "expense" && merchant === null);

  return {
    kind: "parsed",
    needsGemini,
    draft: {
      amount,
      merchant,
      transactionDate,
      transactionTime,
      direction,
      category,
      accountIdentifier,
      referenceNumber,
      relatedReference,
      transactionType,
      confidence,
    },
  };
}

function classify(text: string): TransactionType {
  if (/\b(failed|declined|unsuccessful)\b/i.test(text)) return "failed";
  if (/\brevers(?:al|ed)\b/i.test(text)) return "reversal";
  if (/\brefund\b/i.test(text)) return "refund";
  if (/\bcredit card\b|\bcard bill\b|\bpayment towards\b/i.test(text)) return "own_account_transfer";
  if (/\b(own account|self transfer|to your a\/c|to your account)\b|\btransferred\b/i.test(text)) {
    return "own_account_transfer";
  }
  const debitAt = text.search(/\bdebited\b/i);
  const creditAt = text.search(/\b(?:credited|received)\b/i);
  if (debitAt >= 0 && (creditAt < 0 || debitAt < creditAt)) return "expense";
  if (creditAt >= 0) return "income";
  if (/\b(spent|paid|payment)\b/i.test(text)) return "expense";
  return "unknown";
}

function directionFor(text: string, type: TransactionType): MoneyDirection | null {
  if (type === "refund" || type === "reversal" || type === "income") return "credit";
  if (type === "expense" || type === "own_account_transfer" || type === "failed") return "debit";
  if (/\bcredited\b/i.test(text)) return "credit";
  if (/\bdebited\b/i.test(text)) return "debit";
  return null;
}

function readAmount(text: string): number | null {
  const match = text.match(
    /(?:inr|rs\.?|₹)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i,
  );
  if (!match?.[1]) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

function readAccount(text: string): string | null {
  const match = text.match(
    /(?:a\/c|acct|account)(?:\s+no\.?)?\s*(?:ending\s*)?([xX*]{0,12}\d{3,16})/i,
  );
  if (!match?.[1]) return null;
  const raw = match[1].toUpperCase();
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length >= 8 && !/[X*]/.test(raw)) return `XX${digits.slice(-4)}`;
  return raw;
}

function readReference(text: string): string | null {
  const withoutAgainst = text.replace(/\bagainst\s+[A-Z0-9]{4,22}/gi, " ");
  const explicit = withoutAgainst.match(/\bref\s*[:\-]?\s*([A-Z0-9]{4,22})/i);
  if (explicit?.[1]) return explicit[1].toUpperCase();
  const match = withoutAgainst.match(/\b(?:utr|imps|neft|rrn)\s*[:\-]?\s*([A-Z0-9]{4,22})/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function readRelatedReference(text: string): string | null {
  const match = text.match(/\bagainst\s+([A-Z0-9]{4,22})/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function readMerchant(text: string): string | null {
  const patterns = [
    /\brefund from\s+([A-Za-z][A-Za-z0-9 &'.-]{1,40})/i,
    /\binfo:\s*(?:salary\s+)?([A-Za-z][A-Za-z0-9 &'.-]{1,40})/i,
    /;\s*([A-Za-z][A-Za-z .'-]{1,40}?)\s+credited\b/i,
    /\bfor\s+(?!rs\b|inr\b)([A-Za-z][A-Za-z0-9 &'.-]{1,40})/i,
    /\bto\s+(?!your\b|a\/c\b|acct\b|account\b)([A-Za-z][A-Za-z0-9 &'.-]{1,40})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const merchant = match[1]
        .split(".")[0]
        .replace(/\b(utr|ref|imps|neft|on|from)\b.*$/i, "")
        .trim()
        .replace(/[.,]+$/, "");
    if (merchant.length > 1 && !/^(clearance|customer|account|balance)$/i.test(merchant)) return merchant;
  }
  return null;
}

function readDate(text: string): string | null {
  const named = text.match(
    /\b(\d{1,2})[\/\-.\s]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\/\-.\s]+(\d{2,4})\b/i,
  );
  if (named) {
    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(
      named[2].slice(0, 3).toLowerCase(),
    );
    return isoDate(fullYear(named[3]), month + 1, Number(named[1]));
  }
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const local = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (!local) return null;
  return isoDate(fullYear(local[3]), Number(local[2]), Number(local[1]));
}

function fullYear(raw: string): number {
  if (raw.length === 2) return 2000 + Number(raw);
  return Number(raw);
}

function readTime(text: string): string | null {
  const match = text.match(/\bat\s+([01]?\d|2[0-3])[:.]([0-5]\d)(?:[:.]([0-5]\d))?\s*(am|pm)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2];
  const second = match[3] ?? "00";
  const meridiem = match[4]?.toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:${minute}:${second}`;
}

function categoryFor(merchant: string | null): string | null {
  if (!merchant) return null;
  return CATEGORIES.find((category) => category.pattern.test(merchant))?.name ?? null;
}

function score(fields: {
  amount: number | null;
  transactionType: TransactionType;
  accountIdentifier: string | null;
  transactionDate: string | null;
  merchant: string | null;
  referenceNumber: string | null;
}): number {
  let value = 0.35;
  if (fields.amount !== null) value += 0.2;
  if (fields.transactionType !== "unknown") value += 0.15;
  if (fields.accountIdentifier) value += 0.1;
  if (fields.transactionDate) value += 0.1;
  if (fields.merchant || fields.referenceNumber) value += 0.1;
  return Math.round(Math.min(value, 1) * 100) / 100;
}

function isoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
