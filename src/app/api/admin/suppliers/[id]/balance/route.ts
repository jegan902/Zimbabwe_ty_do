import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { d } from "@/lib/utils/money";
import { successResponse } from "@/lib/utils/response";
import { apiRouteWithParams } from "@/lib/utils/route";
import { ValidationError } from "@/lib/utils/errors";

export const PUT = apiRouteWithParams<{ id: string }>(async (request: NextRequest, { params }) => {
  const admin = await requireApiAdmin(request);
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Body phải là JSON");
  }

  const { balance, alertThreshold, note } = (body as {
    balance?: number | string;
    alertThreshold?: number | string;
    note?: string;
  }) || {};

  const current = await prisma.supplierBalance.findUnique({
    where: { supplierId: id },
  });

  const updated = await prisma.supplierBalance.upsert({
    where: { supplierId: id },
    create: {
      supplierId: id,
      balance: balance ? d(balance).toFixed(2) : "0.00",
      alertThreshold: alertThreshold ? d(alertThreshold).toFixed(2) : "100000.00",
      updatedBy: admin.id,
      lastUpdatedAt: new Date(),
    },
    update: {
      balance: balance ? d(balance).toFixed(2) : undefined,
      alertThreshold: alertThreshold ? d(alertThreshold).toFixed(2) : undefined,
      updatedBy: admin.id,
      lastUpdatedAt: new Date(),
    },
  });

  if (balance && current) {
    await prisma.supplierBalanceLog.create({
      data: {
        supplierId: id,
        balanceBefore: current.balance,
        balanceAfter: d(balance).toFixed(2),
        amount: d(balance).minus(current.balance.toString()).toFixed(2),
        transactionType: "ADJUSTMENT",
        note: note || "Điều chỉnh thủ công từ Admin",
      },
    });
  }

  return successResponse({
    supplierId: id,
    balance: updated.balance.toString(),
    alertThreshold: updated.alertThreshold.toString(),
  });
});

