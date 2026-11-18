import type { NextRequest } from "next/server";
import { ValidationError } from "./errors";

export interface RequestMeta {
  ipAddress: string;
  userAgent: string | null;
}

/**
 * Resolves the client IP.
 *
 * `X-Forwarded-For` is only honoured when `TRUST_PROXY=true`, i.e. when a reverse proxy
 * overwrites that header; otherwise a client could spoof its IP to bypass rate limits.
 * Single-value headers written by edge proxies (`X-Real-IP`, `CF-Connecting-IP`) are used
 * as a fallback so self-hosted deployments keep per-client limits even when `TRUST_PROXY`
 * was not set. When nothing usable is present the caller shares the `unknown` bucket.
 */
export function getClientIp(request: NextRequest): string {
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim();
      if (first) return first.slice(0, 128);
    }
  }

  for (const header of ["x-real-ip", "cf-connecting-ip"]) {
    const value = request.headers.get(header)?.trim();
    if (value) return value.slice(0, 128);
  }

  return "unknown";
}

export function getRequestMeta(request: NextRequest): RequestMeta {
  return {
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
  };
}

export async function parseJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}
