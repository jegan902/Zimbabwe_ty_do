import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";

export const GET = apiRoute(async (request: NextRequest) => {
  await requireApiAdmin(request);
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const search = searchParams.get("search")?.trim() || "";
  const status = searchParams.get("status") || "ALL";
  const role = searchParams.get("role") || "ALL";
  const skip = (page - 1) * limit;

  const where: any = {};

  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { fullName: { contains: search, mode: "insensitive" } },
      { id: { equals: search } },
    ];
  }

  if (status !== "ALL") {
    where.status = status;
  }

  if (role !== "ALL") {
    where.role = role;
  }

  const [items, total, statusCounts, totalWalletAggregate] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        wallet: {
          select: {
            balance: true,
            reservedBalance: true,
            totalDeposits: true,
            totalSpent: true,
          },
        },
        _count: {
          select: {
            orders: true,
            paymentTxns: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
    prisma.user.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    prisma.wallet.aggregate({
      _sum: {
        balance: true,
      },
    }),
  ]);

  const countMap = new Map(statusCounts.map((sc) => [sc.status, sc._count.id]));

  return successResponse({
    items: items.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName || "Chưa cập nhật",
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      balance: u.wallet?.balance ? u.wallet.balance.toString() : "0",
      reservedBalance: u.wallet?.reservedBalance ? u.wallet.reservedBalance.toString() : "0",
      totalDeposits: u.wallet?.totalDeposits ? u.wallet.totalDeposits.toString() : "0",
      totalSpent: u.wallet?.totalSpent ? u.wallet.totalSpent.toString() : "0",
      orderCount: u._count.orders,
      depositCount: u._count.paymentTxns,
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    summary: {
      totalUsers: Array.from(countMap.values()).reduce((a, b) => a + b, 0),
      activeUsers: countMap.get("ACTIVE") || 0,
      lockedUsers: (countMap.get("LOCKED") || 0) + (countMap.get("SUSPENDED") || 0),
      totalWalletBalance: totalWalletAggregate._sum.balance ? totalWalletAggregate._sum.balance.toString() : "0",
    },
  });
});
