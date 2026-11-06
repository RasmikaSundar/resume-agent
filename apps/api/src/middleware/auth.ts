import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import type { AppConfig } from "../config.js";

const HEADER = "x-resume-agent-token";

function readToken(req: { header: (name: string) => string | undefined; query: Record<string, unknown> }): string | undefined {
  const header = req.header(HEADER);
  if (header) return header;
  const query = req.query.token;
  return typeof query === "string" ? query : undefined;
}

export function createAuthMiddleware(config: AppConfig): RequestHandler {
  const expected = Buffer.from(config.sharedSecret, "utf8");

  return (req, res, next) => {
    const token = readToken(req);
    if (!token) {
      res.status(401).json({ error: "Missing X-Resume-Agent-Token" });
      return;
    }
    const provided = Buffer.from(token, "utf8");
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    next();
  };
}
