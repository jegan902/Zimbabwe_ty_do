import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { resolveSupplier } from "@/lib/suppliers/registry";
import { successResponse } from "@/lib/utils/response";
import { apiRouteWithParams } from "@/lib/utils/route";
import { NotFoundError, ValidationError } from "@/lib/utils/errors";
import { computeSellingPrice, d } from "@/lib/utils/money";
import { invalidateProductCache } from "@/lib/cache/cache";

export const POST = apiRouteWithParams<{ id: string }>(async (request: NextRequest, { params }) => {
  await requireApiAdmin(request);
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      mappings: {
        where: { isActive: true },
        include: {
          supplierProduct: true,
        },
        orderBy: { priority: "asc" },
      },
    },
  });

  if (!product) throw new NotFoundError("Không tìm thấy sản phẩm");

  const mapping = product.mappings[0];
  if (!mapping || !mapping.supplierProduct) {
    throw new ValidationError("Sản phẩm này chưa được liên kết với nhà cung cấp nào");
  }

  const { supplierId, supplierProduct } = mapping;
  const { adapter, context } = await resolveSupplier(supplierId);

  // Fetch latest single SKU from supplier
  const item = await adapter.getProduct(context, supplierProduct.supplierProductId);

  const costDecimal = d(item.cost);
  const previousCost = supplierProduct.supplierCost;
  const isCostChanged = !d(previousCost.toString()).equals(costDecimal);

  // Update SupplierProduct
  await prisma.supplierProduct.update({
    where: { id: supplierProduct.id },
    data: {
      name: item.name,
      description: item.description ?? undefined,
      image: item.image ?? undefined,
      supplierCost: costDecimal.toFixed(2),
      previousCost: isCostChanged ? previousCost : undefined,
      stock: item.stock,
      status: item.rawStatus ?? "ACTIVE",
      normalizedStatus: item.isActive ? "ACTIVE" : "INACTIVE",
      lastSyncedAt: new Date(),
      lastChangedAt: isCostChanged ? new Date() : undefined,
    },
  });

  // If AUTO pricing mode, recalculate sellingPrice
  let nextSellingPrice = product.sellingPrice.toString();
  if (product.pricingMode === "AUTO") {
    nextSellingPrice = computeSellingPrice(
      costDecimal,
      product.profitType === "FIXED" ? "FIXED" : "PERCENTAGE",
      product.profitValue.toString()
    ).toFixed(2);
  }

  const isSellingPriceChanged = !d(product.sellingPrice.toString()).equals(d(nextSellingPrice));

  const updatedProduct = await prisma.product.update({
    where: { id: product.id },
    data: {
      supplierCost: costDecimal.toFixed(2),
      sellingPrice: nextSellingPrice,
      stock: item.stock,
      lastSyncedAt: new Date(),
    },
  });

  if (isCostChanged || isSellingPriceChanged) {
    await prisma.productPriceHistory.create({
      data: {
        productId: product.id,
        supplierId,
        supplierProductId: supplierProduct.id,
        supplierCost: costDecimal.toFixed(2),
        previousCost,
        sellingPrice: nextSellingPrice,
        previousSellingPrice: product.sellingPrice,
        profitAmount: d(nextSellingPrice).minus(costDecimal).toFixed(2),
        profitRate: product.profitValue,
        source: "SYNC",
      },
    });
  }

  await invalidateProductCache(product.id);

  return successResponse(
    {
      product: updatedProduct,
      syncedSku: item.supplierProductId,
      cost: costDecimal.toFixed(2),
      stock: item.stock,
      sellingPrice: nextSellingPrice,
    },
    `Đồng bộ thành công SKU ${item.supplierProductId} từ nhà cung cấp`
  );
});
