import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { captureFunds, releaseFunds } from "@/lib/wallet/wallet.service";
import { encryptData } from "@/lib/utils/crypto";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/utils/errors";
import { successResponse } from "@/lib/utils/response";
import { apiRouteWithParams } from "@/lib/utils/route";

export const POST = apiRouteWithParams<{ id: string }>(async (request: NextRequest, { params }) => {
  const admin = await requireApiAdmin(request);
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Body phải là JSON");
  }

  const { action, credentials, note } = (body as {
    action: "FULFILL" | "CANCEL";
    credentials?: string[];
    note?: string;
  }) || {};

  const order = await prisma.order.findUnique({
    where: { id },
  });

  if (!order) throw new NotFoundError("Đơn hàng");
  if (order.status !== "RECONCILIATION" && order.status !== "PROCESSING") {
    throw new ConflictError("Chỉ có thể đối soát đơn hàng ở trạng thái RECONCILIATION hoặc PROCESSING");
  }

  if (action === "FULFILL") {
    if (!credentials || credentials.length === 0) {
      throw new ValidationError("Cần nhập thông tin tài khoản để hoàn tất đơn hàng");
    }

    await captureFunds({
      userId: order.userId,
      orderId: order.id,
      amount: order.totalAmount,
      description: `Đối soát chốt tiền đơn hàng ${order.orderCode} bởi admin`,
    });

    for (let i = 0; i < credentials.length; i++) {
      await prisma.orderCredential.create({
        data: {
          orderId: order.id,
          position: i + 1,
          encryptedData: encryptData(credentials[i]),
        },
      });
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "SUCCESS",
        deliveredQuantity: credentials.length,
        capturedAmount: order.totalAmount,
        reconciliationNote: note || `Đối soát hoàn tất bởi admin ${admin.email}`,
        completedAt: new Date(),
      },
    });

    return successResponse({ message: "Đối soát thành công, đã giao đơn hàng cho khách" });
  } else if (action === "CANCEL") {
    await releaseFunds({
      userId: order.userId,
      orderId: order.id,
      reason: note || `Hủy đối soát bởi admin ${admin.email}`,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "FAILED",
        reconciliationNote: note || `Đơn hàng bị hủy khi đối soát bởi admin ${admin.email}`,
      },
    });

    return successResponse({ message: "Đã hủy đơn hàng và hoàn tiền lại ví cho khách hàng" });
  }

  throw new ValidationError("Hành động không hợp lệ (cần FULFILL hoặc CANCEL)");
});

