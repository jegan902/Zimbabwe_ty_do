import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { successResponse } from "@/lib/utils/response";
import { apiRouteWithParams } from "@/lib/utils/route";
import { NotFoundError, ValidationError } from "@/lib/utils/errors";
import { computeSellingPrice, d } from "@/lib/utils/money";
import { invalidateProductCache } from "@/lib/cache/cache";
import { ProductStatus } from "@prisma/client";

export const GET = apiRouteWithParams<{ id: string }>(async (request: NextRequest, { params }) => {
  await requireApiAdmin(request);
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      mappings: {
        include: {
          supplierProduct: {
            include: {
              supplier: {
                select: { id: true, name: true, adapterKey: true },
              },
            },
          },
        },
      },
      priceHistories: {
        orderBy: { recordedAt: "desc" },
        take: 10,
      },
    },
  });

  if (!product) throw new NotFoundError("Không tìm thấy sản phẩm");

  return successResponse(product);
});

export const PUT = apiRouteWithParams<{ id: string }>(async (request: NextRequest, { params }) => {
  await requireApiAdmin(request);
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Body phải là JSON hợp lệ");
  }

  const existing = await prisma.product.findUnique({
    where: { id },
  });
  if (!existing) throw new NotFoundError("Không tìm thấy sản phẩm");

  const {
    name,
    description,
    image,
    categoryId,
    status,
    isHidden,
    isFeatured,
    pricingMode,
    sellingPrice: inputSellingPrice,
    profitType,
    profitValue,
    supplierCost: inputCost,
    stock,
  } = (body as {
    name?: string;
    description?: string | null;
    image?: string | null;
    categoryId?: string | null;
    status?: ProductStatus;
    isHidden?: boolean;
    isFeatured?: boolean;
    pricingMode?: "AUTO" | "MANUAL";
    sellingPrice?: number | string;
    profitType?: "PERCENTAGE" | "FIXED";
    profitValue?: number | string;
    supplierCost?: number | string;
    stock?: number | null;
  }) || {};

  const nextPricingMode = pricingMode ?? existing.pricingMode;
  const nextProfitType = profitType ?? existing.profitType;
  const nextProfitValue = profitValue !== undefined ? Number(profitValue) : Number(existing.profitValue);
  const nextCost = inputCost !== undefined ? d(inputCost) : d(existing.supplierCost.toString());

  let nextSellingPrice: string;
  if (nextPricingMode === "AUTO") {
    nextSellingPrice = computeSellingPrice(
      nextCost,
      nextProfitType === "FIXED" ? "FIXED" : "PERCENTAGE",
      nextProfitValue.toString()
    ).toFixed(2);
  } else {
    nextSellingPrice = inputSellingPrice !== undefined
      ? d(inputSellingPrice).toFixed(2)
      : existing.sellingPrice.toString();
  }

  const isPriceChanged = !d(existing.sellingPrice.toString()).equals(d(nextSellingPrice));

  const updateData: any = {};
  if (name !== undefined) updateData.name = name.trim();
  if (description !== undefined) updateData.description = description;
  if (image !== undefined) updateData.image = image;
  if (categoryId !== undefined) updateData.categoryId = categoryId || null;
  if (status !== undefined) updateData.status = status;
  if (isHidden !== undefined) updateData.isHidden = isHidden;
  if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
  if (stock !== undefined) updateData.stock = stock !== null ? Number(stock) : null;

  updateData.pricingMode = nextPricingMode;
  updateData.profitType = nextProfitType;
  updateData.profitValue = nextProfitValue;
  updateData.supplierCost = nextCost.toFixed(2);
  updateData.sellingPrice = nextSellingPrice;

  const updated = await prisma.product.update({
    where: { id },
    data: updateData,
    include: {
      category: true,
    },
  });

  if (isPriceChanged) {
    await prisma.productPriceHistory.create({
      data: {
        productId: id,
        supplierCost: nextCost.toFixed(2),
        previousCost: existing.supplierCost,
        sellingPrice: nextSellingPrice,
        previousSellingPrice: existing.sellingPrice,
        profitAmount: d(nextSellingPrice).minus(nextCost).toFixed(2),
        profitRate: nextProfitValue,
        source: "MANUAL",
      },
    });
  }

  await invalidateProductCache(id);

  return successResponse(updated, "Cập nhật sản phẩm thành công");
});

export const DELETE = apiRouteWithParams<{ id: string }>(async (request: NextRequest, { params }) => {
  await requireApiAdmin(request);
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      _count: {
        select: { orders: true },
      },
    },
  });

  if (!product) throw new NotFoundError("Không tìm thấy sản phẩm");

  if (product._count.orders > 0) {
    // Soft delete to preserve order history
    await prisma.product.update({
      where: { id },
      data: { status: "INACTIVE", isHidden: true },
    });
    await invalidateProductCache(id);
    return successResponse(
      { id, action: "DEACTIVATED" },
      "Sản phẩm đã phát sinh đơn hàng, chuyển trạng thái sang TẠM NGỪNG để lưu lịch sử"
    );
  }

  // Safe to delete completely
  await prisma.product.delete({ where: { id } });
  await invalidateProductCache(id);
  return successResponse({ id, action: "DELETED" }, "Đã xóa sản phẩm thành công");
});
