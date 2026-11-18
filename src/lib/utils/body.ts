import type { NextRequest } from "next/server";
import { PayloadTooLargeError } from "./errors";

/** Default ceiling for JSON request bodies accepted by `apiRoute`. */
export const MAX_JSON_BODY_BYTES = 256 * 1024;

/** Payment provider payloads (bank memo, transaction metadata) are larger by nature. */
export const MAX_WEBHOOK_BODY_BYTES = 512 * 1024;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Webhooks get their own ceiling, everything else stays on the JSON limit. */
export function bodyLimitForPath(pathname: string): number {
  return pathname.startsWith("/api/webhooks/")
    ? MAX_WEBHOOK_BODY_BYTES
    : MAX_JSON_BODY_BYTES;
}

/**
 * Rejects oversized bodies before the handler buffers them.
 *
 * `Content-Length` is advisory only (chunked uploads omit it), so this is a cheap
 * first gate. Anything that reads a raw body must use `readTextWithLimit`.
 */
export function assertBodySize(request: NextRequest, maxBytes: number): void {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return;

  const header = request.headers.get("content-length");
  if (!header) return;

  const declared = Number(header);
  // A malformed header is left to the framework; only a real overflow is rejected here.
  if (!Number.isFinite(declared) || declared <= maxBytes) return;

  throw new PayloadTooLargeError(maxBytes);
}

/**
 * Reads a text body while counting the bytes actually received, so a streamed or
 * chunked request cannot bypass the limit and exhaust memory.
 */
export async function readTextWithLimit(
  request: NextRequest,
  maxBytes: number,
): Promise<string> {
  assertBodySize(request, maxBytes);
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      total += value.byteLength;
      if (total > maxBytes) throw new PayloadTooLargeError(maxBytes);

      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
}
