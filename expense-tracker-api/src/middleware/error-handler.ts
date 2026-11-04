import type { NextFunction, Request, Response } from "express";

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (error instanceof SyntaxError) {
    response.status(400).json({ error: "invalid_json" });
    return;
  }

  if (response.headersSent) {
    next(error);
    return;
  }

  const name = error instanceof Error ? error.name : "Error";
  console.error(`request failed: ${name}`);
  response.status(500).json({ error: "internal_error" });
}
