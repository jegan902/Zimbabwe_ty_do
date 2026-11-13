import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";
import { ValidationError } from "@/lib/utils/errors";
import { computeSellingPrice, d } from "@/lib/utils/money";
import { invalidateProductCache } from "@/lib/cache/cache";
import { resolveSupplier } from "@/lib/suppliers/registry";
import { ProductStatus } from "@prisma/client";

export const POST = apiRoute(async (request: NextRequest) => {
  await requireApiAdmin(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Body phải là JSON hợp lệ");
  }

  const { ids, action, data } = (body as {
    ids?: string[];
    action?: "UPDATE_STATUS" | "UPDATE_VISIBILITY" | "UPDATE_PRICING" | "SYNC" | "DELETE";
    data?: any;
  }) || {};

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ValidationError("Vui lòng chọn ít nhất một sản phẩm để thao tác");
  }

  if (!action) {
    throw new ValidationError("Vui lòng chọn thao tác cần thực hiện");
  }

  let affectedCount = 0;

  switch (action) {
    case "UPDATE_STATUS": {
      const nextStatus = data?.status as ProductStatus;
      if (!nextStatus || !["ACTIVE", "INACTIVE", "OUT_OF_STOCK"].includes(nextStatus)) {
        throw new ValidationError("Trạng thái cập nhật không hợp lệ");
      }

      const res = await prisma.product.updateMany({
        where: { id: { in: ids } },
        data: { status: nextStatus },
      });
      affectedCount = res.count;
      for (const id of ids) {
        await invalidateProductCache(id);
      }
      return successResponse(
        { affectedCount },
        `Đã chuyển ${affectedCount} sản phẩm sang trạng thái ${nextStatus === "ACTIVE" ? "ĐANG BÁN" : "TẠM NGỪNG"}`
      );
    }

    case "UPDATE_VISIBILITY": {
      const isHidden = Boolean(data?.isHidden);
      const res = await prisma.product.updateMany({
        where: { id: { in: ids } },
        data: { isHidden },
      });
      affectedCount = res.count;
      for (const id of ids) {
        await invalidateProductCache(id);
      }
      return successResponse(
        { affectedCount },
        `Đã ${isHidden ? "ẨN" : "HIỆN"} ${affectedCount} sản phẩm trên trang bán hàng`
      );
    }

    case "UPDATE_PRICING": {
      const profitType = data?.profitType === "FIXED" ? "FIXED" : "PERCENTAGE";
      const profitValue = Number(data?.profitValue) || 10;
      const pricingMode = data?.pricingMode === "MANUAL" ? "MANUAL" : "AUTO";

      const products = await prisma.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, supplierCost: true, sellingPrice: true },
      });

      for (const p of products) {
        const costDecimal = d(p.supplierCost.toString());
        let newSellingPrice: string;

        if (pricingMode === "AUTO") {
          newSellingPrice = computeSellingPrice(
            costDecimal,
            profitType,
            profitValue.toString()
          ).toFixed(2);
        } else {
          newSellingPrice = data?.sellingPrice ? d(data.sellingPrice).toFixed(2) : p.sellingPrice.toString();
        }

        const isPriceChanged = !d(p.sellingPrice.toString()).equals(d(newSellingPrice));

        await prisma.product.update({
          where: { id: p.id },
          data: {
            pricingMode,
            profitType,
            profitValue,
            sellingPrice: newSellingPrice,
          },
        });

        if (isPriceChanged) {
          await prisma.productPriceHistory.create({
            data: {
              productId: p.id,
              supplierCost: costDecimal.toFixed(2),
              previousCost: p.supplierCost,
              sellingPrice: newSellingPrice,
              previousSellingPrice: p.sellingPrice,
              profitAmount: d(newSellingPrice).minus(costDecimal).toFixed(2),
              profitRate: profitValue,
              source: "MANUAL",
            },
          });
        }

        await invalidateProductCache(p.id);
        affectedCount++;
      }

      return successResponse(
        { affectedCount },
        `Đã cập nhật công thức giá & biên lợi nhuận cho ${affectedCount} sản phẩm`
      );
    }

    case "SYNC": {
      // Find all products and their active mappings
      const products = await prisma.product.findMany({
        where: { id: { in: ids } },
        include: {
          mappings: {
            where: { isActive: true },
            include: { supplierProduct: true },
            orderBy: { priority: "asc" },
          },
        },
      });

      let syncSuccess = 0;
      let syncFailed = 0;

      for (const p of products) {
        const mapping = p.mappings[0];
        if (!mapping || !mapping.supplierProduct) {
          syncFailed++;
          continue;
        }

        try {
          const { adapter, context } = await resolveSupplier(mapping.supplierId);
          const item = await adapter.getProduct(context, mapping.supplierProduct.supplierProductId);

          const costDecimal = d(item.cost);
          const previousCost = mapping.supplierProduct.supplierCost;
          const isCostChanged = !d(previousCost.toString()).equals(costDecimal);

          // Update SupplierProduct
          await prisma.supplierProduct.update({
            where: { id: mapping.supplierProduct.id },
            data: {
              name: item.name,
              supplierCost: costDecimal.toFixed(2),
              previousCost: isCostChanged ? previousCost : undefined,
              stock: item.stock,
              status: item.rawStatus ?? "ACTIVE",
              normalizedStatus: item.isActive ? "ACTIVE" : "INACTIVE",
              lastSyncedAt: new Date(),
              lastChangedAt: isCostChanged ? new Date() : undefined,
            },
          });

          // Recalculate selling price if AUTO
          let nextSellingPrice = p.sellingPrice.toString();
          if (p.pricingMode === "AUTO") {
            nextSellingPrice = computeSellingPrice(
              costDecimal,
              p.profitType === "FIXED" ? "FIXED" : "PERCENTAGE",
              p.profitValue.toString()
            ).toFixed(2);
          }

          const isSellingChanged = !d(p.sellingPrice.toString()).equals(d(nextSellingPrice));

          await prisma.product.update({
            where: { id: p.id },
            data: {
              supplierCost: costDecimal.toFixed(2),
              sellingPrice: nextSellingPrice,
              stock: item.stock,
              lastSyncedAt: new Date(),
            },
          });

          if (isCostChanged || isSellingChanged) {
            await prisma.productPriceHistory.create({
              data: {
                productId: p.id,
                supplierId: mapping.supplierId,
                supplierProductId: mapping.supplierProduct.id,
                supplierCost: costDecimal.toFixed(2),
                previousCost,
                sellingPrice: nextSellingPrice,
                previousSellingPrice: p.sellingPrice,
                profitAmount: d(nextSellingPrice).minus(costDecimal).toFixed(2),
                profitRate: p.profitValue,
                source: "SYNC",
              },
            });
          }

          await invalidateProductCache(p.id);
          syncSuccess++;
        } catch {
          syncFailed++;
        }
      }

      return successResponse(
        { syncSuccess, syncFailed },
        `Đồng bộ hoàn tất: ${syncSuccess} sản phẩm thành công${syncFailed > 0 ? `, ${syncFailed} bỏ qua/lỗi` : ""}`
      );
    }

    case "DELETE": {
      // Check which products have orders
      const productsWithOrders = await prisma.product.findMany({
        where: {
          id: { in: ids },
          orders: { some: {} },
        },
        select: { id: true },
      });

      const orderProductIds = new Set(productsWithOrders.map((p) => p.id));
      const safeToDelete = ids.filter((id) => !orderProductIds.has(id));
      const softDeleteIds = ids.filter((id) => orderProductIds.has(id));

      if (softDeleteIds.length > 0) {
        await prisma.product.updateMany({
          where: { id: { in: softDeleteIds } },
          data: { status: "INACTIVE", isHidden: true },
        });
      }

      if (safeToDelete.length > 0) {
        await prisma.product.deleteMany({
          where: { id: { in: safeToDelete } },
        });
      }

      for (const id of ids) {
        await invalidateProductCache(id);
      }

      return successResponse(
        { deletedCount: safeToDelete.length, deactivatedCount: softDeleteIds.length },
        `Đã xóa ${safeToDelete.length} sản phẩm${softDeleteIds.length > 0 ? ` (và ẩn ${softDeleteIds.length} sản phẩm đã có đơn hàng)` : ""}`
      );
    }

    default:
      throw new ValidationError("Thao tác không được hỗ trợ");
  }
});
