import { NextRequest } from "next/server";
import { processPaymentWebhook } from "@/lib/services/payment.service";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";
import { ValidationError } from "@/lib/utils/errors";

export const POST = apiRoute(async (request: NextRequest) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const signature = request.headers.get("x-signature") || undefined;
  const result = await processPaymentWebhook(body as Record<string, any>, signature);

  return successResponse(result);
});

