import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { adjustWalletBalance } from "@/lib/wallet/wallet.service";
import { NotFoundError, ValidationError } from "@/lib/utils/errors";
import { successResponse } from "@/lib/utils/response";
import { apiRouteWithParams } from "@/lib/utils/route";

export const POST = apiRouteWithParams<{ id: string }>(async (request: NextRequest, { params }) => {
  const admin = await requireApiAdmin(request);
  const { id } = await params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Body phải là JSON");
  }

  const { amount, operation, reason } = body || {};

  if (!amount || typeof amount !== "number" || amount <= 0) {
    throw new ValidationError("Số tiền điều chỉnh phải lớn hơn 0");
  }

  if (!operation || !["ADD", "SUBTRACT"].includes(operation)) {
    throw new ValidationError("Thao tác điều chỉnh phải là 'ADD' (Cộng tiền) hoặc 'SUBTRACT' (Trừ tiền)");
  }

  if (!reason || typeof reason !== "string" || reason.trim().length < 3) {
    throw new ValidationError("Vui lòng nhập lý do điều chỉnh rõ ràng (ít nhất 3 ký tự)");
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true },
  });

  if (!user) throw new NotFoundError("Khách hàng");

  const snapshot = await adjustWalletBalance({
    userId: user.id,
    amount: String(amount),
    operation,
    reason: reason.trim(),
    actorId: admin.id,
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: operation === "ADD" ? "CREDIT_USER_WALLET" : "DEBIT_USER_WALLET",
      entityType: "WALLET",
      entityId: user.id,
      changes: JSON.stringify({ amount, operation, reason: reason.trim() }),
      metadata: JSON.stringify({ adminEmail: admin.email, userEmail: user.email }),
    },
  });

  return successResponse({
    message: `${operation === "ADD" ? "Cộng tiền" : "Trừ tiền"} thành công!`,
    wallet: snapshot,
  });
});
