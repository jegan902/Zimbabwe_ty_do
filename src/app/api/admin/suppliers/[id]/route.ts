import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { encryptSecret } from "@/lib/suppliers/http";
import { getAdapter, hasAdapter } from "@/lib/suppliers/registry";
import { successResponse } from "@/lib/utils/response";
import { apiRouteWithParams } from "@/lib/utils/route";
import { NotFoundError, ValidationError } from "@/lib/utils/errors";
import { invalidateProductCache } from "@/lib/cache/cache";
import { pushEvent } from "@/lib/realtime/bus";

export const PUT = apiRouteWithParams<{ id: string }>(async (request: NextRequest, { params }) => {
  await requireApiAdmin(request);
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Body phải là JSON");
  }

  const { apiKey, baseUrl, profitValue, status, adapterKey, name } = (body as {
    apiKey?: string;
    baseUrl?: string;
    profitValue?: number;
    status?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
    adapterKey?: string;
    name?: string;
  }) || {};

  const existing = await prisma.supplier.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new NotFoundError("Không tìm thấy nhà cung cấp");
  }

  const updateData: any = {};
  if (name && name.trim()) {
    updateData.name = name.trim();
  }
  if (apiKey && apiKey.trim()) {
    updateData.apiKey = encryptSecret(apiKey.trim());
  }
  if (baseUrl && baseUrl.trim()) {
    updateData.baseUrl = baseUrl.trim();
  }
  if (profitValue !== undefined && profitValue !== null) {
    updateData.profitValue = profitValue;
  }
  if (status && status !== existing.status) {
    updateData.status = status;

    if (status === "INACTIVE" || status === "SUSPENDED") {
      // 1. Deactivate all mappings for this supplier
      await prisma.productSupplierMapping.updateMany({
        where: { supplierId: id },
        data: { isActive: false },
      });

      // 2. Find all products associated with this supplier
      const mappings = await prisma.productSupplierMapping.findMany({
        where: { supplierId: id },
        select: { productId: true },
      });
      const productIds = [...new Set(mappings.map((m) => m.productId))];

      for (const pId of productIds) {
        // Check if there are other active suppliers for this product
        const otherActiveCount = await prisma.productSupplierMapping.count({
          where: {
            productId: pId,
            isActive: true,
            supplierProduct: {
              supplier: { status: "ACTIVE" },
            },
          },
        });

        if (otherActiveCount === 0) {
          await prisma.product.update({
            where: { id: pId },
            data: { status: "INACTIVE", isHidden: true },
          });
        }
      }

      await invalidateProductCache();
      pushEvent({
        type: "product.synced",
        supplierId: id,
        payload: { message: "Supplier stopped selling, products hidden from web", status: "INACTIVE" },
      });
    } else if (status === "ACTIVE") {
      // 1. Re-activate all mappings for this supplier
      await prisma.productSupplierMapping.updateMany({
        where: { supplierId: id },
        data: { isActive: true },
      });

      // 2. Find all products associated with this supplier
      const mappings = await prisma.productSupplierMapping.findMany({
        where: { supplierId: id },
        select: { productId: true },
      });
      const productIds = [...new Set(mappings.map((m) => m.productId))];

      for (const pId of productIds) {
        await prisma.product.update({
          where: { id: pId },
          data: { status: "ACTIVE", isHidden: false },
        });
      }

      await invalidateProductCache();
      pushEvent({
        type: "product.synced",
        supplierId: id,
        payload: { message: "Supplier reactivated, products visible on web", status: "ACTIVE" },
      });
    }
  }
  if (adapterKey && adapterKey.trim()) {
    const key = adapterKey.trim();
    if (!hasAdapter(key)) {
      throw new ValidationError(`Adapter "${key}" không tồn tại`);
    }
    const adapter = getAdapter(key);
    updateData.adapterKey = key;
    updateData.supportsBalanceApi = adapter.supportsBalance;
    updateData.supportsStock = adapter.supportsStock;
    updateData.supportsWebhook = adapter.supportsWebhook;
  }

  const updated = await prisma.supplier.update({
    where: { id },
    data: updateData,
  });

  return successResponse({
    id: updated.id,
    name: updated.name,
    baseUrl: updated.baseUrl,
    status: updated.status,
    profitValue: updated.profitValue.toString(),
  });
});

export const DELETE = apiRouteWithParams<{ id: string }>(async (request: NextRequest, { params }) => {
  await requireApiAdmin(request);
  const { id } = await params;

  const existing = await prisma.supplier.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          transactions: true,
          products: true,
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError("Không tìm thấy nhà cung cấp");
  }

  // If supplier has transactions, soft-delete to preserve accounting integrity
  if (existing._count.transactions > 0) {
    await prisma.supplier.update({
      where: { id },
      data: { status: "INACTIVE" },
    });
    return successResponse(
      { id, action: "DEACTIVATED" },
      "Nhà cung cấp đã có giao dịch phát sinh, chuyển sang trạng thái VÔ HIỆU HÓA để lưu lịch sử kế toán"
    );
  }

  // Safe to delete completely
  await prisma.supplier.delete({ where: { id } });
  return successResponse({ id, action: "DELETED" }, "Đã xóa nhà cung cấp thành công");
});
