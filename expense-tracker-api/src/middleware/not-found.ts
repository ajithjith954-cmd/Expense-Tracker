import type { Request, Response } from "express";

export function notFound(_request: Request, response: Response): void {
  response.status(404).json({ error: "not_found" });
}
