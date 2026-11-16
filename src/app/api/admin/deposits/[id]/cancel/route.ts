import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { ConflictError, NotFoundError } from "@/lib/utils/errors";
import { successResponse } from "@/lib/utils/response";
import { apiRouteWithParams } from "@/lib/utils/route";

export const POST = apiRouteWithParams<{ id: string }>(async (request: NextRequest, { params }) => {
  const admin = await requireApiAdmin(request);
  const { id } = await params;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional
  }

  const { reason } = body || {};

  const paymentTxn = await prisma.paymentTransaction.findUnique({
    where: { id },
  });

  if (!paymentTxn) throw new NotFoundError("Giao dịch nạp tiền");

  if (paymentTxn.status === "VERIFIED") {
    throw new ConflictError("Không thể hủy giao dịch đã xác nhận thành công");
  }

  const updated = await prisma.paymentTransaction.update({
    where: { id },
    data: {
      status: "CANCELLED",
      failureReason: reason || `Hủy bởi admin ${admin.email}`,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "CANCEL_DEPOSIT_TRANSACTION",
      entityType: "PAYMENT_TRANSACTION",
      entityId: paymentTxn.id,
      changes: JSON.stringify({ status: "CANCELLED", reason }),
      metadata: JSON.stringify({ adminEmail: admin.email, paymentCode: paymentTxn.paymentCode }),
    },
  });

  return successResponse({
    message: `Đã hủy giao dịch nạp tiền ${paymentTxn.paymentCode}`,
    transaction: {
      id: updated.id,
      paymentCode: updated.paymentCode,
      status: updated.status,
    },
  });
});
