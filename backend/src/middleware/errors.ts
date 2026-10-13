import type { ErrorRequestHandler, RequestHandler } from "express";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof z.ZodError) {
    res.status(400).json({
      error: "Validation failed",
      issues: err.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  // body-parser errors (malformed JSON, payload too large) carry a client status.
  if (typeof err?.status === "number" && err.status >= 400 && err.status < 500 && err.expose) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
