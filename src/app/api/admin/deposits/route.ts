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
  const skip = (page - 1) * limit;

  const where: any = {};

  if (status !== "ALL") {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { paymentCode: { contains: search, mode: "insensitive" } },
      { gatewayTxnId: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { user: { fullName: { contains: search, mode: "insensitive" } } },
    ];
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [items, total, verifiedAggregates, pendingCount, todayVerifiedAggregates] =
    await Promise.all([
      prisma.paymentTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, email: true, fullName: true } },
        },
      }),
      prisma.paymentTransaction.count({ where }),
      prisma.paymentTransaction.aggregate({
        where: { status: "VERIFIED" },
        _sum: { receivedAmount: true, amount: true },
        _count: { id: true },
      }),
      prisma.paymentTransaction.count({
        where: { status: "PENDING" },
      }),
      prisma.paymentTransaction.aggregate({
        where: {
          status: "VERIFIED",
          verifiedAt: { gte: startOfToday },
        },
        _sum: { receivedAmount: true, amount: true },
        _count: { id: true },
      }),
    ]);

  const totalVerifiedMoney = verifiedAggregates._sum.receivedAmount
    ? verifiedAggregates._sum.receivedAmount.toString()
    : verifiedAggregates._sum.amount
    ? verifiedAggregates._sum.amount.toString()
    : "0";

  const todayVerifiedMoney = todayVerifiedAggregates._sum.receivedAmount
    ? todayVerifiedAggregates._sum.receivedAmount.toString()
    : todayVerifiedAggregates._sum.amount
    ? todayVerifiedAggregates._sum.amount.toString()
    : "0";

  return successResponse({
    items: items.map((p) => ({
      id: p.id,
      paymentCode: p.paymentCode,
      customerEmail: p.user.email,
      customerName: p.user.fullName || "Chưa cập nhật",
      userId: p.userId,
      amount: p.amount.toString(),
      receivedAmount: p.receivedAmount ? p.receivedAmount.toString() : null,
      status: p.status,
      paymentMethod: p.paymentMethod,
      gateway: p.gateway,
      gatewayTxnId: p.gatewayTxnId,
      gatewayResponse: p.gatewayResponse,
      expiresAt: p.expiresAt,
      paidAt: p.paidAt,
      verifiedAt: p.verifiedAt,
      failureReason: p.failureReason,
      createdAt: p.createdAt,
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    summary: {
      totalVerifiedAmount: totalVerifiedMoney,
      totalVerifiedCount: verifiedAggregates._count.id || 0,
      todayVerifiedAmount: todayVerifiedMoney,
      todayVerifiedCount: todayVerifiedAggregates._count.id || 0,
      pendingCount,
    },
  });
});
