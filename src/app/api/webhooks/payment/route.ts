import { NextRequest } from "next/server";
import { processPaymentWebhook } from "@/lib/services/payment.service";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";
import { MAX_WEBHOOK_BODY_BYTES, readTextWithLimit } from "@/lib/utils/body";
import {
  ValidationError,
  AuthenticationError,
  AppError,
} from "@/lib/utils/errors";
import { isProduction } from "@/lib/env";
import crypto from "crypto";
import logger from "@/lib/utils/logger";

function verifySePaySignature(
  rawBody: string,
  parsedBody: any,
  signature: string | null,
  timestamp: string | null,
  secret: string,
): boolean {
  if (!signature || !timestamp) {
    return false;
  }

  // SePay HMAC signature formula: 'sha256=' + hmac(timestamp + '.' + body)
  const hmacRaw =
    "sha256=" +
    crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");
  const hmacStringified =
    "sha256=" +
    crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${JSON.stringify(parsedBody)}`)
      .digest("hex");

  const sigBuf = Buffer.from(signature);
  const rawBuf = Buffer.from(hmacRaw);
  const strBuf = Buffer.from(hmacStringified);

  if (
    sigBuf.length === rawBuf.length &&
    crypto.timingSafeEqual(sigBuf, rawBuf)
  ) {
    return true;
  }
  if (
    sigBuf.length === strBuf.length &&
    crypto.timingSafeEqual(sigBuf, strBuf)
  ) {
    return true;
  }

  return false;
}

/** Constant-time comparison for API keys and shared secrets. */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export const POST = apiRoute(async (request: NextRequest) => {
  let body: any;

  // Read with a byte ceiling: a streamed body without Content-Length must not be
  // able to buffer the process out of memory before the signature check runs.
  const rawBody = await readTextWithLimit(request, MAX_WEBHOOK_BODY_BYTES);
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  // 1. Verify Authentication / Signature. A webhook that credits wallets must never run
  // unverified: if nothing is configured the route fails closed in production. Only
  // local development keeps the permissive path.
  const webhookSecret = process.env.SEPAY_WEBHOOK_SECRET;
  const apiKey = process.env.SEPAY_API_KEY;
  const signature = request.headers.get("x-sepay-signature");
  const timestamp = request.headers.get("x-sepay-timestamp");
  // A URL-shaped value cannot be an HMAC secret; older deployments only shipped an API key.
  const hmacSecret =
    webhookSecret && !webhookSecret.startsWith("http")
      ? webhookSecret
      : undefined;

  if (!hmacSecret && !apiKey) {
    if (isProduction()) {
      logger.error(
        "SePay webhook rejected: neither SEPAY_WEBHOOK_SECRET nor SEPAY_API_KEY is configured",
      );
      throw new AppError(
        503,
        "WEBHOOK_NOT_CONFIGURED",
        "Webhook thanh toán chưa được cấu hình",
      );
    }
    logger.warn(
      "SePay webhook secret is not configured. Processing without verification in dev mode.",
    );
  } else {
    const authHeader = request.headers.get("authorization") || "";
    const providedApiKey = authHeader.startsWith("Apikey ")
      ? authHeader.slice(7).trim()
      : "";

    const isApiKeyValid =
      !!apiKey &&
      providedApiKey.length > 0 &&
      safeCompare(providedApiKey, apiKey);

    let isHmacValid = false;
    if (hmacSecret) {
      // Check HMAC-SHA256
      isHmacValid = verifySePaySignature(
        rawBody,
        body,
        signature,
        timestamp,
        hmacSecret,
      );
      // Also support fallback to Authorization: Apikey <secret>
      if (!isHmacValid && !isApiKeyValid && providedApiKey.length > 0) {
        isHmacValid = safeCompare(providedApiKey, apiKey || hmacSecret);
      }
    }

    if (!isHmacValid && !isApiKeyValid) {
      logger.warn(
        { signature, timestamp },
        "SePay webhook verification failed: invalid signature",
      );
      throw new AuthenticationError("Chữ ký webhook SePay không hợp lệ");
    }
  }

  const result = await processPaymentWebhook(
    body as Record<string, any>,
    request.headers.get("x-sepay-signature") ||
      request.headers.get("x-signature") ||
      undefined,
  );

  return successResponse(result);
});
