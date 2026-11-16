import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { createDepositIntent } from "@/lib/services/payment.service";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";
import { NotFoundError, ValidationError } from "@/lib/utils/errors";
import { prisma } from "@/lib/utils/db";

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

export const GET = apiRoute(async (request: NextRequest) => {
  const user = await requireApiUser(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const id = searchParams.get("id");

  if (!code && !id) {
    throw new ValidationError("Thiếu mã giao dịch (code hoặc id)");
  }

  const txn = await prisma.paymentTransaction.findFirst({
    where: {
      userId: user.id,
      OR: [
        ...(id ? [{ id }] : []),
        ...(code ? [{ paymentCode: code }] : []),
      ],
    },
  });

  if (!txn) {
    throw new NotFoundError("Giao dịch nạp tiền");
  }

  // Tự động chuyển CANCELLED nếu đã quá hạn 5 phút và đang PENDING
  if (txn.status === "PENDING" && txn.expiresAt && txn.expiresAt < new Date()) {
    const updated = await prisma.paymentTransaction.update({
      where: { id: txn.id },
      data: {
        status: "CANCELLED",
        failureReason: "Quá thời hạn 5 phút (Tự động hủy)",
      },
    });
    return successResponse({
      transaction: {
        id: updated.id,
        paymentCode: updated.paymentCode,
        amount: updated.amount.toString(),
        receivedAmount: updated.receivedAmount?.toString() || null,
        status: updated.status,
        expiresAt: updated.expiresAt,
        failureReason: updated.failureReason,
      },
    });
  }

  return successResponse({
    transaction: {
      id: txn.id,
      paymentCode: txn.paymentCode,
      amount: txn.amount.toString(),
      receivedAmount: txn.receivedAmount?.toString() || null,
      status: txn.status,
      expiresAt: txn.expiresAt,
      failureReason: txn.failureReason,
    },
  });
});

