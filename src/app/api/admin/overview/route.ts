import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { d } from "@/lib/utils/money";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";

export const GET = apiRoute(async (request: NextRequest) => {
  await requireApiAdmin(request);

  const [
    orderAggregates,
    orderCounts,
    userCount,
    walletAggregates,
    supplierBalances,
    recentOrders,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { status: "SUCCESS" },
      _sum: {
        totalAmount: true,
        profit: true,
        totalCost: true,
      },
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    prisma.user.count(),
    prisma.wallet.aggregate({
      _sum: {
        balance: true,
        totalDeposits: true,
        totalSpent: true,
      },
    }),
    prisma.supplierBalance.aggregate({
      _sum: {
        balance: true,
        totalTopUps: true,
        totalSpent: true,
      },
    }),
    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { email: true, username: true } },
        product: { select: { name: true } },
      },
    }),
  ]);

  const countsMap = new Map(orderCounts.map((c) => [c.status, c._count.id]));

  return successResponse({
    metrics: {
      totalRevenue: orderAggregates._sum.totalAmount ? orderAggregates._sum.totalAmount.toString() : "0",
      totalProfit: orderAggregates._sum.profit ? orderAggregates._sum.profit.toString() : "0",
      totalCost: orderAggregates._sum.totalCost ? orderAggregates._sum.totalCost.toString() : "0",
      totalOrders: Array.from(countsMap.values()).reduce((a, b) => a + b, 0),
      successOrders: countsMap.get("SUCCESS") || 0,
      failedOrders: countsMap.get("FAILED") || 0,
      reconciliationOrders: countsMap.get("RECONCILIATION") || 0,
      processingOrders: (countsMap.get("PENDING") || 0) + (countsMap.get("PROCESSING") || 0),
      totalUsers: userCount,
      totalCustomerWallet: walletAggregates._sum.balance ? walletAggregates._sum.balance.toString() : "0",
      totalCustomerDeposits: walletAggregates._sum.totalDeposits ? walletAggregates._sum.totalDeposits.toString() : "0",
      totalSupplierBalances: supplierBalances._sum.balance ? supplierBalances._sum.balance.toString() : "0",
    },
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      orderCode: o.orderCode,
      productName: o.product.name,
      customerEmail: o.user.email,
      totalAmount: o.totalAmount.toString(),
      profit: o.profit.toString(),
      status: o.status,
      createdAt: o.createdAt,
    })),
  });
});

