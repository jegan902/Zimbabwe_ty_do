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
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search")?.trim() || "";
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status && status !== "ALL") {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { orderCode: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { product: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        user: { select: { email: true, fullName: true } },
        product: { select: { id: true, name: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return successResponse({
    items: items.map((o) => ({
      id: o.id,
      orderCode: o.orderCode,
      productName: o.product.name,
      customerEmail: o.user.email,
      quantity: o.quantity,
      sellingPrice: o.sellingPrice.toString(),
      totalAmount: o.totalAmount.toString(),
      supplierCost: o.supplierCost.toString(),
      profit: o.profit.toString(),
      status: o.status,
      supplierTransId: o.supplierTransId,
      reconciliationNote: o.reconciliationNote,
      createdAt: o.createdAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

