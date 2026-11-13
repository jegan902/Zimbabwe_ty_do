import { NextRequest } from "next/server";
import { processPaymentWebhook } from "@/lib/services/payment.service";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";
import { ValidationError, AuthenticationError } from "@/lib/utils/errors";
import crypto from "crypto";
import logger from "@/lib/utils/logger";

function verifySePaySignature(
  rawBody: string,
  parsedBody: any,
  signature: string | null,
  timestamp: string | null,
  secret: string
): boolean {
  if (!signature || !timestamp) {
    return false;
  }

  // SePay HMAC signature formula: 'sha256=' + hmac(timestamp + '.' + body)
  const hmacRaw = "sha256=" + crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const hmacStringified =
    "sha256=" + crypto.createHmac("sha256", secret).update(`${timestamp}.${JSON.stringify(parsedBody)}`).digest("hex");

  const sigBuf = Buffer.from(signature);
  const rawBuf = Buffer.from(hmacRaw);
  const strBuf = Buffer.from(hmacStringified);

  if (sigBuf.length === rawBuf.length && crypto.timingSafeEqual(sigBuf, rawBuf)) {
    return true;
  }
  if (sigBuf.length === strBuf.length && crypto.timingSafeEqual(sigBuf, strBuf)) {
    return true;
  }

  return false;
}

export const POST = apiRoute(async (request: NextRequest) => {
  let rawBody: string;
  let body: any;

  try {
    rawBody = await request.text();
    body = JSON.parse(rawBody);
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  // 1. Verify Authentication / Signature if secret is configured
  const webhookSecret = process.env.SEPAY_WEBHOOK_SECRET;
  const apiKey = process.env.SEPAY_API_KEY;

  if (webhookSecret && !webhookSecret.startsWith("https://")) {
    const signature = request.headers.get("x-sepay-signature");
    const timestamp = request.headers.get("x-sepay-timestamp");

    // Check HMAC-SHA256
    const isHmacValid = verifySePaySignature(rawBody, body, signature, timestamp, webhookSecret);

    // Also support fallback to Authorization: Apikey <secret>
    const authHeader = request.headers.get("authorization") || "";
    const isApiKeyValid =
      authHeader.startsWith("Apikey ") && authHeader.slice(7).trim() === (apiKey || webhookSecret);

    if (!isHmacValid && !isApiKeyValid) {
      logger.warn({ signature, timestamp }, "SePay webhook verification failed: invalid signature");
      throw new AuthenticationError("Chữ ký webhook SePay không hợp lệ");
    }
  } else if (apiKey) {
    const authHeader = request.headers.get("authorization") || "";
    if (!authHeader.startsWith("Apikey ") || authHeader.slice(7).trim() !== apiKey) {
      logger.warn("SePay webhook verification failed: invalid api key");
      throw new AuthenticationError("API Key webhook SePay không hợp lệ");
    }
  } else {
    logger.warn("SePay webhook secret is not configured. Processing without verification in dev mode.");
  }

  const signature = request.headers.get("x-sepay-signature") || request.headers.get("x-signature") || undefined;
  const result = await processPaymentWebhook(body as Record<string, any>, signature);

  return successResponse(result);
});


