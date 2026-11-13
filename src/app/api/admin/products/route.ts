import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { createdResponse, successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";
import { ConflictError, ValidationError } from "@/lib/utils/errors";
import { computeSellingPrice, d } from "@/lib/utils/money";
import { invalidateProductCache } from "@/lib/cache/cache";
import { ProductStatus } from "@prisma/client";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export const GET = apiRoute(async (request: NextRequest) => {
  await requireApiAdmin(request);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const search = searchParams.get("search")?.trim() || "";
  const categoryId = searchParams.get("categoryId") || "";
  const supplierId = searchParams.get("supplierId") || "";
  const status = searchParams.get("status") || "";
  const pricingMode = searchParams.get("pricingMode") || "";

  const where: any = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      {
        mappings: {
          some: {
            supplierProduct: {
              supplierProductId: { contains: search, mode: "insensitive" },
            },
          },
        },
      },
    ];
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (status && status !== "ALL") {
    where.status = status as ProductStatus;
  }

  if (pricingMode && pricingMode !== "ALL") {
    where.pricingMode = pricingMode;
  }

  if (supplierId && supplierId !== "ALL") {
    where.mappings = {
      some: {
        supplierId,
      },
    };
  }

  const [total, products, categories, suppliers, countActive, countOos, countAuto] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        mappings: {
          include: {
            supplierProduct: {
              select: {
                id: true,
                supplierProductId: true,
                name: true,
                supplierCost: true,
                stock: true,
                status: true,
                normalizedStatus: true,
                supplier: {
                  select: { id: true, name: true, adapterKey: true },
                },
              },
            },
          },
          orderBy: { priority: "asc" },
        },
      },
    }),
    prisma.category.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.supplier.findMany({
      select: { id: true, name: true, adapterKey: true },
      orderBy: { priority: "asc" },
    }),
    prisma.product.count({ where: { status: "ACTIVE" } }),
    prisma.product.count({
      where: {
        OR: [{ status: "OUT_OF_STOCK" }, { stock: 0 }],
      },
    }),
    prisma.product.count({ where: { pricingMode: "AUTO" } }),
  ]);

  const formattedProducts = products.map((p) => {
    const cost = d(p.supplierCost.toString());
    const selling = d(p.sellingPrice.toString());
    const profitAmount = selling.minus(cost);
    const profitRate = cost.greaterThan(0)
      ? profitAmount.dividedBy(cost).times(100).toFixed(1)
      : "0";

    const activeMapping = p.mappings.find((m) => m.isActive) || p.mappings[0];

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      image: p.image,
      category: p.category,
      categoryId: p.categoryId,
      supplierCost: p.supplierCost.toString(),
      sellingPrice: p.sellingPrice.toString(),
      profitType: p.profitType,
      profitValue: p.profitValue.toString(),
      pricingMode: p.pricingMode,
      profitAmount: profitAmount.toFixed(2),
      profitRatePercent: profitRate,
      stock: p.stock,
      status: p.status,
      isFeatured: p.isFeatured,
      isHidden: p.isHidden,
      sortOrder: p.sortOrder,
      lastSyncedAt: p.lastSyncedAt,
      createdAt: p.createdAt,
      activeSupplier: activeMapping?.supplierProduct?.supplier
        ? {
            id: activeMapping.supplierProduct.supplier.id,
            name: activeMapping.supplierProduct.supplier.name,
            adapterKey: activeMapping.supplierProduct.supplier.adapterKey,
            supplierProductId: activeMapping.supplierProduct.supplierProductId,
            supplierCost: activeMapping.supplierProduct.supplierCost.toString(),
          }
        : null,
      mappingsCount: p.mappings.length,
    };
  });

  return successResponse({
    products: formattedProducts,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    metrics: {
      total,
      activeCount: countActive,
      outOfStockCount: countOos,
      autoPricingCount: countAuto,
    },
    filterOptions: {
      categories,
      suppliers,
    },
  });
});

export const POST = apiRoute(async (request: NextRequest) => {
  await requireApiAdmin(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Body phải là JSON hợp lệ");
  }

  const {
    name,
    slug: customSlug,
    description,
    image,
    categoryId,
    supplierCost = 0,
    sellingPrice,
    profitType = "PERCENTAGE",
    profitValue = 10,
    pricingMode = "AUTO",
    stock,
    isFeatured = false,
    isHidden = false,
  } = (body as {
    name?: string;
    slug?: string;
    description?: string;
    image?: string;
    categoryId?: string;
    supplierCost?: number | string;
    sellingPrice?: number | string;
    profitType?: "PERCENTAGE" | "FIXED";
    profitValue?: number | string;
    pricingMode?: "AUTO" | "MANUAL";
    stock?: number | null;
    isFeatured?: boolean;
    isHidden?: boolean;
  }) || {};

  if (!name?.trim()) throw new ValidationError("Tên sản phẩm không được để trống");

  let slug = customSlug?.trim() ? slugify(customSlug) : slugify(name);
  if (!slug) slug = `sp-${Date.now()}`;

  const existingSlug = await prisma.product.findUnique({ where: { slug } });
  if (existingSlug) {
    slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
  }

  const costDecimal = d(supplierCost || 0);
  let finalSellingPrice: string;

  if (pricingMode === "MANUAL" && sellingPrice) {
    finalSellingPrice = d(sellingPrice).toFixed(2);
  } else {
    finalSellingPrice = computeSellingPrice(
      costDecimal,
      profitType === "FIXED" ? "FIXED" : "PERCENTAGE",
      profitValue.toString()
    ).toFixed(2);
  }

  const product = await prisma.product.create({
    data: {
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      image: image?.trim() || null,
      categoryId: categoryId || null,
      supplierCost: costDecimal.toFixed(2),
      sellingPrice: finalSellingPrice,
      profitType: profitType === "FIXED" ? "FIXED" : "PERCENTAGE",
      profitValue: Number(profitValue) || 10,
      pricingMode: pricingMode === "MANUAL" ? "MANUAL" : "AUTO",
      stock: stock !== undefined && stock !== null ? Number(stock) : null,
      status: "ACTIVE",
      isFeatured: Boolean(isFeatured),
      isHidden: Boolean(isHidden),
      priceHistories: {
        create: {
          supplierCost: costDecimal.toFixed(2),
          sellingPrice: finalSellingPrice,
          profitAmount: d(finalSellingPrice).minus(costDecimal).toFixed(2),
          profitRate: Number(profitValue) || 10,
          source: "MANUAL",
        },
      },
    },
    include: {
      category: true,
    },
  });

  await invalidateProductCache(product.id);

  return createdResponse(product, "Tạo sản phẩm mới thành công");
});
