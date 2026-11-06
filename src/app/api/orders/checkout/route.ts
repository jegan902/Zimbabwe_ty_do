import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { checkoutDirect } from "@/lib/services/order.service";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";
import { ValidationError } from "@/lib/utils/errors";

export const POST = apiRoute(async (request: NextRequest) => {
  const user = await requireApiUser(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Body phải là JSON");
  }

  const { productId, quantity, confirmedPrice } =
    (body as { productId?: string; quantity?: number; confirmedPrice?: string }) || {};

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

