import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { hashPassword } from "@/lib/utils/crypto";
import { NotFoundError, ValidationError } from "@/lib/utils/errors";
import { successResponse } from "@/lib/utils/response";
import { apiRouteWithParams } from "@/lib/utils/route";
import { d } from "@/lib/utils/money";

export const GET = apiRouteWithParams<{ id: string }>(async (request: NextRequest, { params }) => {
  await requireApiAdmin(request);
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      wallet: true,
      orders: {
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: { id: true, name: true } },
        },
      },
      paymentTxns: {
        take: 20,
        orderBy: { createdAt: "desc" },
      },
      walletTransactions: {
        take: 30,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) throw new NotFoundError("Khách hàng");

  const balance = user.wallet?.balance ? d(user.wallet.balance.toString()) : d(0);
  const reserved = user.wallet?.reservedBalance ? d(user.wallet.reservedBalance.toString()) : d(0);
  const available = balance.minus(reserved);

  return successResponse({
    profile: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      failedLoginCount: user.failedLoginCount,
      lockedUntil: user.lockedUntil,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      apiKey: user.apiKey,
      ipWhitelist: user.ipWhitelist,
    },
    wallet: {
      balance: balance.toString(),
      reservedBalance: reserved.toString(),
      availableBalance: available.isNegative() ? "0" : available.toString(),
      totalDeposits: user.wallet?.totalDeposits ? user.wallet.totalDeposits.toString() : "0",
      totalSpent: user.wallet?.totalSpent ? user.wallet.totalSpent.toString() : "0",
      totalRefunded: user.wallet?.totalRefunded ? user.wallet.totalRefunded.toString() : "0",
    },
    orders: user.orders.map((o) => ({
      id: o.id,
      orderCode: o.orderCode,
      productName: o.product.name,
      quantity: o.quantity,
      totalAmount: o.totalAmount.toString(),
      status: o.status,
      createdAt: o.createdAt,
    })),
    deposits: user.paymentTxns.map((p) => ({
      id: p.id,
      paymentCode: p.paymentCode,
      amount: p.amount.toString(),
      receivedAmount: p.receivedAmount ? p.receivedAmount.toString() : null,
      status: p.status,
      gateway: p.gateway,
      paymentMethod: p.paymentMethod,
      gatewayTxnId: p.gatewayTxnId,
      paidAt: p.paidAt,
      verifiedAt: p.verifiedAt,
      createdAt: p.createdAt,
    })),
    ledger: user.walletTransactions.map((tx) => ({
      id: tx.id,
      type: tx.transactionType,
      amount: tx.amount.toString(),
      balanceBefore: tx.balanceBefore.toString(),
      balanceAfter: tx.balanceAfter.toString(),
      status: tx.status,
      description: tx.description,
      createdAt: tx.createdAt,
    })),
  });
});

export const PATCH = apiRouteWithParams<{ id: string }>(async (request: NextRequest, { params }) => {
  const admin = await requireApiAdmin(request);
  const { id } = await params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Body phải là JSON");
  }

  const { fullName, status, role, newPassword } = body;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Khách hàng");

  const updateData: any = {};

  if (typeof fullName === "string") {
    updateData.fullName = fullName.trim();
  }

  if (status && ["ACTIVE", "LOCKED", "SUSPENDED"].includes(status)) {
    updateData.status = status;
    if (status === "ACTIVE") {
      updateData.failedLoginCount = 0;
      updateData.lockedUntil = null;
    }
  }

  if (role && ["USER", "ADMIN"].includes(role)) {
    updateData.role = role;
  }

  if (newPassword) {
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      throw new ValidationError("Mật khẩu mới phải có ít nhất 6 ký tự");
    }
    updateData.passwordHash = await hashPassword(newPassword);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
  });

  // Log Audit
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "UPDATE_USER_PROFILE",
      entityType: "USER",
      entityId: id,
      changes: JSON.stringify(updateData),
      metadata: JSON.stringify({ adminEmail: admin.email, targetEmail: existing.email }),
    },
  });

  return successResponse({
    message: "Cập nhật thông tin khách hàng thành công",
    user: {
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      role: updated.role,
      status: updated.status,
    },
  });
});
