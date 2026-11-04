import express, { type Express } from "express";

import { createGeminiExtractor } from "./gemini.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFound } from "./middleware/not-found.js";
import { createExtractRouter, type ExtractTransaction } from "./routes/extract-transaction.js";
import { healthRouter } from "./routes/health.js";

type AppOptions = {
  extract?: ExtractTransaction;
  rateLimit?: { limit: number; windowMs: number };
};

export function createApp(options: AppOptions = {}): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));
  app.use(healthRouter);
  app.use(
    createExtractRouter({
      extract: options.extract ?? createGeminiExtractor(),
      rateLimit: options.rateLimit,
    }),
  );
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
