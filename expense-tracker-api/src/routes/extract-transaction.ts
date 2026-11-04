import { Router } from "express";

import { GeminiConfigError, GeminiResponseError } from "../gemini.js";
import { isOtpOnly } from "../message-guard.js";
import { createRateLimiter } from "../rate-limit.js";
import { extractionRequestSchema, extractionResponseSchema, type ExtractionResponse } from "../schema.js";

export type ExtractTransaction = (message: string) => Promise<ExtractionResponse>;

type ExtractRouteOptions = {
  extract: ExtractTransaction;
  rateLimit?: { limit: number; windowMs: number };
};

export function createExtractRouter({
  extract,
  rateLimit = { limit: 20, windowMs: 60_000 },
}: ExtractRouteOptions): Router {
  const router = Router();
  const limiter = createRateLimiter(rateLimit);

  router.post("/api/extract-transaction", async (request, response) => {
    const caller = request.ip || "unknown";
    if (!limiter.allow(caller)) {
      response.set("retry-after", String(Math.ceil(rateLimit.windowMs / 1000)));
      response.status(429).json({
        error: "rate_limited",
        message: "Too many extraction requests. Try again shortly.",
      });
      return;
    }

    const body = extractionRequestSchema.safeParse(request.body);
    if (!body.success) {
      response.status(400).json({
        error: "invalid_request",
        message: "Send a message string of 1 to 2000 characters.",
      });
      return;
    }

    if (isOtpOnly(body.data.message)) {
      response.status(422).json({
        error: "not_financial",
        message: "OTPs are not sent to Gemini.",
      });
      return;
    }

    try {
      const extracted = extractionResponseSchema.safeParse(await extract(body.data.message));
      if (!extracted.success) throw new GeminiResponseError();
      response.json(extracted.data);
    } catch (error) {
      if (error instanceof GeminiConfigError) {
        response.status(503).json({
          error: "gemini_not_configured",
          message: "GEMINI_API_KEY is not set on the server.",
        });
        return;
      }
      if (error instanceof GeminiResponseError) {
        response.status(502).json({
          error: "extraction_invalid",
          message: "Gemini did not return a usable transaction.",
        });
        return;
      }
      response.status(502).json({
        error: "extraction_failed",
        message: "Gemini could not be reached.",
      });
    }
  });

  return router;
}
