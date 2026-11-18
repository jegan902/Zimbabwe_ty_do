import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { checkoutDirect } from "@/lib/services/order.service";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";
import { ValidationError } from "@/lib/utils/errors";

export const POST = apiRoute(async (request: NextRequest) => {
  const user = await requireApiUser(request);

  // Every checkout reserves money and calls the supplier in the same tick, so a burst of
  // requests is both a cost and a double-spend risk.
  await consumeRateLimit("orders-checkout", user.id, 10, 60);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Body phải là JSON");
  }

  const { productId, quantity, confirmedPrice } =
    (body as {
      productId?: string;
      quantity?: number;
      confirmedPrice?: string;
    }) || {};

  if (!productId || typeof productId !== "string") {
    throw new ValidationError("productId là bắt buộc");
  }

  const result = await checkoutDirect({
    userId: user.id,
    productId,
    quantity: quantity || 1,
    confirmedPrice,
  });

  return successResponse(result);
});
