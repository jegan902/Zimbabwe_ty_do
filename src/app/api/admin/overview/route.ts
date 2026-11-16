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
    depositAggregates,
    supplierBalances,
    recentOrders,
    activeSuppliers,
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
        reservedBalance: true,
        totalDeposits: true,
        totalSpent: true,
      },
    }),
    prisma.paymentTransaction.aggregate({
      where: { status: "VERIFIED" },
      _sum: {
        receivedAmount: true,
        amount: true,
      },
      _count: { id: true },
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
        user: { select: { email: true, fullName: true } },
        product: { select: { name: true } },
      },
    }),
    prisma.supplier.findMany({
      where: { status: "ACTIVE" },
      include: { balance: true },
      orderBy: { priority: "asc" },
    }),
  ]);

  const supplierAccounts = await Promise.all(
    activeSuppliers.map(async (supplier) => {
      const profileLog = await prisma.supplierApiLog.findFirst({
        where: {
          supplierId: supplier.id,
          endpoint: { contains: "profile" },
          success: true,
        },
        orderBy: { createdAt: "desc" },
      });

      let username: string | undefined = undefined;
      let liveBalance: string | undefined = undefined;

      if (profileLog?.responseData) {
        try {
          const parsed = JSON.parse(profileLog.responseData);
          const data = parsed.data || parsed;
          username = data.username || data.name || data.user;
          liveBalance = data.money || data.balance || data.sodu;
        } catch {}
      }

      return {
        id: supplier.id,
        name: supplier.name,
        adapterKey: supplier.adapterKey,
        username: username || "Chưa xác định",
        baseUrl: supplier.baseUrl,
        connectionStatus: supplier.connectionStatus,
        connectionError: supplier.connectionError,
        lastCheckedAt: supplier.lastCheckedAt,
        balance: supplier.balance?.balance.toString() || "0",
        liveBalance: liveBalance || supplier.balance?.balance.toString() || "0",
        balanceType: supplier.balance?.balanceType || "ESTIMATED",
        alertThreshold: supplier.balance?.alertThreshold.toString() || "50000",
      };
    })
  );

  const supplierAccount = supplierAccounts[0] || null;
  const countsMap = new Map(orderCounts.map((c) => [c.status, c._count.id]));

  const rawBalance = walletAggregates._sum.balance ? d(walletAggregates._sum.balance.toString()) : d(0);
  const rawReserved = walletAggregates._sum.reservedBalance ? d(walletAggregates._sum.reservedBalance.toString()) : d(0);
  const rawAvailable = rawBalance.minus(rawReserved);

  const verifiedDepositAmount = depositAggregates._sum.receivedAmount
    ? depositAggregates._sum.receivedAmount.toString()
    : depositAggregates._sum.amount
    ? depositAggregates._sum.amount.toString()
    : walletAggregates._sum.totalDeposits
    ? walletAggregates._sum.totalDeposits.toString()
    : "0";

  return successResponse({
    supplierAccount,
    supplierAccounts,
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
      totalCustomerWallet: rawBalance.toString(),
      totalCustomerReserved: rawReserved.toString(),
      totalCustomerAvailable: rawAvailable.isNegative() ? "0" : rawAvailable.toString(),
      totalCustomerDeposits: verifiedDepositAmount,
      verifiedDepositCount: depositAggregates._count.id || 0,
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

