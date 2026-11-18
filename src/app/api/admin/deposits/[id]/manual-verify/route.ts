import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { creditWallet } from "@/lib/wallet/wallet.service";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/utils/errors";
import { successResponse } from "@/lib/utils/response";
import { apiRouteWithParams } from "@/lib/utils/route";
import { realtimeBus } from "@/lib/realtime/bus";
import { d } from "@/lib/utils/money";

export const POST = apiRouteWithParams<{ id: string }>(
  async (request: NextRequest, { params }) => {
    const admin = await requireApiAdmin(request);
    const { id } = await params;

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional
    }

    const { receivedAmount, note } = body || {};

    const paymentTxn = await prisma.paymentTransaction.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true } },
      },
    });

    if (!paymentTxn) throw new NotFoundError("Giao dịch nạp tiền");

    if (paymentTxn.status === "VERIFIED") {
      throw new ConflictError(
        "Giao dịch nạp tiền này đã được xác nhận trước đó",
      );
    }

    const finalAmount =
      receivedAmount && typeof receivedAmount === "number" && receivedAmount > 0
        ? receivedAmount
        : Number(paymentTxn.amount);

    const idempotencyKey = `manual-verify-${paymentTxn.id}`;

    // Credit wallet through wallet service
    await creditWallet({
      userId: paymentTxn.userId,
      amount: d(finalAmount),
      transactionType: "DEPOSIT",
      referenceId: paymentTxn.id,
      idempotencyKey,
      description: `Nạp tiền qua QR (${paymentTxn.paymentCode}) - Duyệt thủ công bởi ${admin.email}`,
    });

    // Update payment transaction
    const updatedTxn = await prisma.paymentTransaction.update({
      where: { id: paymentTxn.id },
      data: {
        status: "VERIFIED",
        receivedAmount: d(finalAmount).toFixed(2),
        paidAt: new Date(),
        verifiedAt: new Date(),
        gatewayResponse: JSON.stringify({
          manualVerifiedBy: admin.email,
          adminId: admin.id,
          note: note || "Duyệt nạp tiền thủ công qua đối soát sao kê",
          verifiedAt: new Date().toISOString(),
        }),
      },
    });

    // Broadcast realtime update to user's wallet
    realtimeBus.publish({
      type: "wallet.updated",
      userId: paymentTxn.userId,
      payload: { amount: finalAmount, paymentCode: paymentTxn.paymentCode },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: "MANUAL_VERIFY_DEPOSIT",
        entityType: "PAYMENT_TRANSACTION",
        entityId: paymentTxn.id,
        changes: JSON.stringify({
          paymentCode: paymentTxn.paymentCode,
          amount: finalAmount,
          note,
        }),
        metadata: JSON.stringify({
          adminEmail: admin.email,
          customerEmail: paymentTxn.user.email,
        }),
      },
    });

    return successResponse({
      message: `Đã duyệt nạp tiền thành công cho mã ${paymentTxn.paymentCode}`,
      transaction: {
        id: updatedTxn.id,
        paymentCode: updatedTxn.paymentCode,
        receivedAmount: updatedTxn.receivedAmount?.toString(),
        status: updatedTxn.status,
      },
    });
  },
);
