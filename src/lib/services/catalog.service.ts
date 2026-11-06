import { prisma } from "@/lib/utils/db";
import { cacheGet, cacheSet, CACHE_KEYS } from "@/lib/cache/cache";
import { NotFoundError } from "@/lib/utils/errors";
import { Prisma } from "@prisma/client";

export interface ProductListParams {
  page?: number;
  limit?: number;
  categoryId?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "price_asc" | "price_desc" | "newest" | "name";
  status?: "ACTIVE" | "INACTIVE" | "ALL";
  includeHidden?: boolean;
}

export async function getCategories() {
  const cached = await cacheGet<Array<{ id: string; name: string; slug: string; _count: { products: number } }>>(
    "cache:categories:list"
  );
  if (cached) return cached;

  const categories = await prisma.category.findMany({
    where: { status: "ACTIVE" },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      icon: true,
      description: true,
      _count: {
        select: {
          products: {
            where: { status: "ACTIVE", isHidden: false },
          },
        },
      },
    },
  });

  await cacheSet("cache:categories:list", categories, 300);
  return categories;
}

export async function getProducts(params: ProductListParams = {}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 12));
  const skip = (page - 1) * limit;

  const where: Prisma.ProductWhereInput = {};

  if (!params.includeHidden) {
    where.isHidden = false;
  }

  if (params.status && params.status !== "ALL") {
    where.status = params.status;
  } else if (!params.status) {
    where.status = "ACTIVE";
  }

  if (params.categoryId) {
    where.categoryId = params.categoryId;
  }

  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: "insensitive" } },
      { description: { contains: params.search, mode: "insensitive" } },
    ];
  }

  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    where.sellingPrice = {};
    if (params.minPrice !== undefined) {
      where.sellingPrice.gte = new Prisma.Decimal(params.minPrice);
    }
    if (params.maxPrice !== undefined) {
      where.sellingPrice.lte = new Prisma.Decimal(params.maxPrice);
    }
  }

  let orderBy: Prisma.ProductOrderByWithRelationInput = { sortOrder: "asc" };
  if (params.sortBy === "price_asc") {
    orderBy = { sellingPrice: "asc" };
  } else if (params.sortBy === "price_desc") {
    orderBy = { sellingPrice: "desc" };
  } else if (params.sortBy === "newest") {
    orderBy = { createdAt: "desc" };
  } else if (params.sortBy === "name") {
    orderBy = { name: "asc" };
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        sellingPrice: true,
        stock: true,
        status: true,
        isFeatured: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: items.map((p) => ({
      ...p,
      sellingPrice: p.sellingPrice.toString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getProductBySlug(slug: string) {
  const cacheKey = `${CACHE_KEYS.productDetail}slug:${slug}`;
  const cached = await cacheGet<Record<string, unknown>>(cacheKey);
  if (cached) return cached;

  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: {
        select: { id: true, name: true, slug: true },
      },
      mappings: {
        where: { isActive: true },
        include: {
          supplierProduct: {
            include: {
              supplier: {
                select: { id: true, name: true, status: true },
              },
            },
          },
        },
      },
    },
  });

  if (!product) throw new NotFoundError("Sản phẩm");

  // Determine availability
  const hasActiveSource = product.mappings.some(
    (m: any) => m.supplierProduct?.supplier?.status === "ACTIVE" && !m.supplierProduct?.isStale
  );

  const formatted = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    image: product.image,
    gallery: product.gallery ? JSON.parse(product.gallery) : [],
    sellingPrice: product.sellingPrice.toString(),
    stock: product.stock,
    status: product.status,
    isAvailable: hasActiveSource && product.status === "ACTIVE",
    category: product.category,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };

  await cacheSet(cacheKey, formatted, 60);
  return formatted;
}

export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      mappings: {
        include: {
          supplierProduct: {
            include: {
              supplier: true,
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

  if (!product) throw new NotFoundError("Sản phẩm");

  return {
    ...product,
    supplierCost: product.supplierCost.toString(),
    sellingPrice: product.sellingPrice.toString(),
    profitValue: product.profitValue.toString(),
    priceHistories: product.priceHistories.map((h: any) => ({
      ...h,
      supplierCost: h.supplierCost.toString(),
      sellingPrice: h.sellingPrice.toString(),
      profitAmount: h.profitAmount.toString(),
    })),
  };
}
