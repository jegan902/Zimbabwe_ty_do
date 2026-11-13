import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { syncSupplierProducts } from "@/lib/services/supplier.service";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";

export const POST = apiRoute(async (request: NextRequest) => {
  await requireApiAdmin(request);

  const activeSuppliers = await prisma.supplier.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, adapterKey: true },
    orderBy: { priority: "asc" },
  });

  if (activeSuppliers.length === 0) {
    return successResponse(
      {
        totalSuppliers: 0,
        results: [],
        summary: { totalProducts: 0, newProducts: 0, updatedProducts: 0, priceChangedProducts: 0, failedProducts: 0 },
      },
      "Không có nhà cung cấp nào đang ở trạng thái ACTIVE"
    );
  }

  const results: any[] = [];
  const summary = {
    totalProducts: 0,
    newProducts: 0,
    updatedProducts: 0,
    priceChangedProducts: 0,
    failedProducts: 0,
  };

  for (const supplier of activeSuppliers) {
    try {
      const res = await syncSupplierProducts(supplier.id, "MANUAL");
      results.push({
        supplierName: supplier.name,
        adapterKey: supplier.adapterKey,
        ...res,
      });

      summary.totalProducts += res.totalProducts;
      summary.newProducts += res.newProducts;
      summary.updatedProducts += res.updatedProducts;
      summary.priceChangedProducts += res.priceChangedProducts;
      summary.failedProducts += res.failedProducts;
    } catch (err: any) {
      results.push({
        supplierId: supplier.id,
        supplierName: supplier.name,
        adapterKey: supplier.adapterKey,
        status: "FAILED",
        error: err.message,
      });
      summary.failedProducts++;
    }
  }

  return successResponse(
    {
      totalSuppliers: activeSuppliers.length,
      summary,
      results,
    },
    `Đồng bộ hoàn tất ${activeSuppliers.length} nhà cung cấp: +${summary.newProducts} mới, ${summary.updatedProducts} cập nhật, ${summary.priceChangedProducts} đổi giá`
  );
});
