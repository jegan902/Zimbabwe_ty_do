import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { cancelDepositIntent } from "@/lib/services/payment.service";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";
import { ValidationError } from "@/lib/utils/errors";

export const POST = apiRoute(async (request: NextRequest) => {
  const user = await requireApiUser(request);

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // Optional body
  }

  const { transactionId, paymentCode, reason } = body || {};
  const identifier = transactionId || paymentCode;

  if (!identifier) {
    throw new ValidationError("Cần cung cấp transactionId hoặc paymentCode");
  }

  const result = await cancelDepositIntent(
    user.id,
    identifier,
    reason || "Quá thời hạn 5 phút (Tự động hủy)"
  );

  return successResponse(result);
});
