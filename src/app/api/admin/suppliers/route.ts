import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";

export const GET = apiRoute(async (request: NextRequest) => {
  await requireApiAdmin(request);

  const suppliers = await prisma.supplier.findMany({
    orderBy: { priority: "asc" },
    include: {
      balance: true,
      syncSettings: true,
      _count: {
        select: {
          products: true,
          transactions: true,
        },
      },
    },
  });

  return successResponse(
    suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      adapterKey: s.adapterKey,
      baseUrl: s.baseUrl,
      status: s.status,
      connectionStatus: s.connectionStatus,
      connectionError: s.connectionError,
      lastCheckedAt: s.lastCheckedAt,
      lastSyncAt: s.lastSyncAt,
      lastSyncError: s.lastSyncError,
      profitType: s.profitType,
      profitValue: s.profitValue.toString(),
      supportsBalanceApi: s.supportsBalanceApi,
      supportsStock: s.supportsStock,
      supportsWebhook: s.supportsWebhook,
      productCount: s._count.products,
      balance: s.balance
        ? {
            balance: s.balance.balance.toString(),
            estimatedBalance: s.balance.estimatedBalance.toString(),
            balanceType: s.balance.balanceType,
            totalTopUps: s.balance.totalTopUps.toString(),
            totalSpent: s.balance.totalSpent.toString(),
            alertThreshold: s.balance.alertThreshold.toString(),
          }
        : null,
      syncSettings: s.syncSettings,
    }))
  );
});

