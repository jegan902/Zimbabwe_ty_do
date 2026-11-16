import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { decryptData } from "@/lib/utils/crypto";
import { releaseFunds } from "@/lib/wallet/wallet.service";
import { NotFoundError } from "@/lib/utils/errors";
import { successResponse } from "@/lib/utils/response";
import { apiRouteWithParams } from "@/lib/utils/route";

export const GET = apiRouteWithParams<{ id: string }>(async (request: NextRequest, { params }) => {
  await requireApiAdmin(request);
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, fullName: true } },
      product: { select: { id: true, name: true, slug: true, image: true } },
      credentials: { orderBy: { position: "asc" } },
      statusHistories: { orderBy: { changedAt: "desc" } },
      reservation: true,
    },
  });

  if (!order) throw new NotFoundError("Đơn hàng");

  // Decrypt credentials safely if present
  const decryptedCredentials = order.credentials.map((c) => {
    let plain = "";
    try {
      plain = decryptData(c.encryptedData);
    } catch {
      plain = "[Không thể giải mã]";
    }
    return {
      id: c.id,
      position: c.position,
      data: plain,
      createdAt: c.createdAt,
    };
  });

  // Find supplier info
  let supplierName = order.supplierId;
  const supplier = await prisma.supplier.findUnique({
    where: { id: order.supplierId },
    select: { name: true },
  });
  if (supplier) supplierName = supplier.name;

  return successResponse({
    order: {
      id: order.id,
      orderCode: order.orderCode,
      user: order.user,
      product: order.product,
      supplierId: order.supplierId,
      supplierName,
      supplierProductId: order.supplierProductId,
      quantity: order.quantity,
      supplierCost: order.supplierCost.toString(),
      sellingPrice: order.sellingPrice.toString(),
      totalCost: order.totalCost.toString(),
      totalAmount: order.totalAmount.toString(),
      profit: order.profit.toString(),
      deliveredQuantity: order.deliveredQuantity,
      capturedAmount: order.capturedAmount.toString(),
      refundedAmount: order.refundedAmount.toString(),
      supplierTransId: order.supplierTransId,
      supplierOrderRef: order.supplierOrderRef,
      couponCode: order.couponCode,
      status: order.status,
      errorCode: order.errorCode,
      errorDetails: order.errorDetails,
      reconciliationNote: order.reconciliationNote,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      completedAt: order.completedAt,
      credentials: decryptedCredentials,
      statusHistories: order.statusHistories.map((h) => ({
        id: h.id,
        statusFrom: h.statusFrom,
        statusTo: h.statusTo,
        reason: h.reason,
        actorId: h.actorId,
        changedAt: h.changedAt,
      })),
      hasActiveReservation: order.reservation?.status === "RESERVED",
    },
  });
});

export const DELETE = apiRouteWithParams<{ id: string }>(async (request: NextRequest, { params }) => {
  const admin = await requireApiAdmin(request);
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { reservation: true },
  });

  if (!order) throw new NotFoundError("Đơn hàng");

  // If there is an active reservation, release funds to avoid trapped balance
  if (order.reservation && order.reservation.status === "RESERVED") {
    await releaseFunds({
      userId: order.userId,
      orderId: order.id,
      reason: `Giải phóng tiền giữ chỗ khi xóa đơn hàng bởi admin ${admin.email}`,
    });
  }

  // Delete cascade relations and the order inside a transaction
  await prisma.$transaction(async (tx) => {
    await tx.orderCredential.deleteMany({ where: { orderId: order.id } });
    await tx.orderStatusHistory.deleteMany({ where: { orderId: order.id } });
    await tx.walletReservation.deleteMany({ where: { orderId: order.id } });
    await tx.order.delete({ where: { id: order.id } });
  });

  // Log Audit
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "DELETE_ORDER",
      entityType: "ORDER",
      entityId: order.id,
      changes: JSON.stringify({ orderCode: order.orderCode, totalAmount: order.totalAmount.toString(), status: order.status }),
      metadata: JSON.stringify({ adminEmail: admin.email, deletedOrderCode: order.orderCode }),
    },
  });

  return successResponse({
    message: `Đã xóa đơn hàng ${order.orderCode} thành công`,
  });
});
