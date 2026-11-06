import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { createDepositIntent } from "@/lib/services/payment.service";
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

  const { amount } = (body as { amount?: number }) || {};
  if (!amount || typeof amount !== "number") {
    throw new ValidationError("Số tiền nạp không hợp lệ");
  }

  const result = await createDepositIntent(user.id, amount);
  return successResponse(result);
});

