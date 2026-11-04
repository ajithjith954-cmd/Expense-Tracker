import { z } from "zod";

/**
 * Contract for a Gemini extraction result.
 * Unknown keys are rejected. Missing facts must be null, not guessed.
 * The mobile TransactionDraft in mobile/src/types/transaction.ts uses the same field names.
 */
export const transactionTypeSchema = z.enum([
  "expense",
  "income",
  "own_account_transfer",
  "refund",
  "reversal",
  "failed",
  "unknown",
]);

export const extractionRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(2000),
  })
  .strict();

export const extractionResponseSchema = z
  .object({
    amount: z.number().positive().nullable(),
    merchant: z.string().min(1).nullable(),
    transactionDate: z.string().date().nullable(),
    transactionTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/)
      .nullable(),
    direction: z.enum(["debit", "credit"]).nullable(),
    category: z.string().min(1).nullable(),
    accountIdentifier: z.string().min(1).nullable(),
    referenceNumber: z.string().min(1).nullable(),
    transactionType: transactionTypeSchema,
    confidence: z.number().min(0).max(1),
    extractionMethod: z.literal("gemini"),
  })
  .strict();

export type ExtractionResponse = z.infer<typeof extractionResponseSchema>;
