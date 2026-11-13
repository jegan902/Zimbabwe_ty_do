import { prisma } from "@/lib/utils/db";
import logger from "@/lib/utils/logger";
import { encryptData, decryptData } from "@/lib/utils/crypto";
import { SupplierUnavailableError } from "@/lib/utils/errors";

/**
 * Supplier HTTP transport.
 *
 * Responsibilities:
 *  - enforce a hard timeout with AbortController
 *  - retry only idempotent requests, never POSTs that could double-charge
 *  - persist an API log row with credentials redacted
 *  - normalise transport errors into a single error type
 */

export interface SupplierRequestOptions {
  supplierId: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  timeoutMs: number;
  headers?: Record<string, string>;
  body?: FormData | string;
  /** Read-only calls may be retried; purchase calls must not be. */
  retryable?: boolean;
  maxRetries?: number;
  /** Values replaced with "***" before anything is written to the log. */
  redact?: string[];
}

export interface SupplierHttpResponse {
  status: number;
  ok: boolean;
  text: string;
  contentType: string | null;
  durationMs: number;
}

const RETRY_DELAYS_MS = [400, 1200];

function redactValue(text: string, secrets: string[]): string {
  let result = text;
  for (const secret of secrets) {
    if (!secret || secret.length < 4) continue;
    result = result.split(secret).join("***");
  }
  return result;
}

function truncateForLog(text: string, max = 8000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…[truncated ${text.length - max} chars]`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeApiLog(entry: {
  supplierId: string;
  method: string;
  endpoint: string;
  statusCode: number | null;
  success: boolean;
  requestData: string | null;
  responseData: string | null;
  errorMessage: string | null;
  responseTimeMs: number;
}) {
  try {
    await prisma.supplierApiLog.create({ data: entry });
  } catch (error) {
    logger.warn({ err: error, supplierId: entry.supplierId }, "Cannot persist supplier API log");
  }
}

async function performRequest(options: SupplierRequestOptions): Promise<SupplierHttpResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(options.url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
      // Supplier data must never be served from Next's fetch cache.
      cache: "no-store",
      redirect: "follow",
    });

    const text = await response.text();
    return {
      status: response.status,
      ok: response.ok,
      text,
      contentType: response.headers.get("content-type"),
      durationMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

function describeEndpoint(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search ? "?…" : ""}`;
  } catch {
    return "invalid-url";
  }
}

export async function supplierRequest(
  options: SupplierRequestOptions
): Promise<SupplierHttpResponse> {
  const secrets = options.redact ?? [];
  const maxRetries = options.retryable ? (options.maxRetries ?? 2) : 0;
  let lastError: unknown = null;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const response = await performRequest(options);
      const success = response.ok;
      const loggableBody = redactValue(truncateForLog(response.text), secrets);

      await writeApiLog({
        supplierId: options.supplierId,
        method: options.method,
        endpoint: describeEndpoint(options.url),
        statusCode: response.status,
        success,
        requestData: null,
        responseData: success ? loggableBody : null,
        errorMessage: success
          ? null
          : `HTTP ${response.status}: ${loggableBody.slice(0, 500)}`,
        responseTimeMs: response.durationMs,
      });

      // Retry only 5xx and 429 on idempotent requests.
      const transient = response.status >= 500 || response.status === 429;
      if (transient && attempt < maxRetries) {
        await sleep(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]);
        attempt += 1;
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      const isAbort = error instanceof Error && error.name === "AbortError";
      const message = isAbort
        ? `Request timeout after ${options.timeoutMs}ms`
        : (error as Error).message;

      await writeApiLog({
        supplierId: options.supplierId,
        method: options.method,
        endpoint: describeEndpoint(options.url),
        statusCode: null,
        success: false,
        requestData: null,
        responseData: null,
        errorMessage: redactValue(message, secrets).slice(0, 500),
        responseTimeMs: options.timeoutMs,
      });

      if (attempt < maxRetries) {
        await sleep(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]);
        attempt += 1;
        continue;
      }
      break;
    }
  }

  const reason =
    lastError instanceof Error ? lastError.message : "Supplier endpoint unreachable";
  throw new SupplierUnavailableError(`Không kết nối được nhà cung cấp: ${reason}`);
}

/**
 * Supplier credentials are encrypted at rest. Values written before encryption
 * existed are read as-is, which keeps existing installations working.
 */
const ENCRYPTED_PREFIX = "enc:v1:";

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return plaintext;
  return `${ENCRYPTED_PREFIX}${encryptData(plaintext)}`;
}

export function decryptSecret(stored: string): string {
  if (!stored) return stored;
  if (!stored.startsWith(ENCRYPTED_PREFIX)) return stored;
  try {
    return decryptData(stored.slice(ENCRYPTED_PREFIX.length));
  } catch {
    return "";
  }
}

export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 4)}${"•".repeat(Math.min(12, value.length - 8))}${value.slice(-4)}`;
}