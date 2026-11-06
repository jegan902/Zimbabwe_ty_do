import { prisma } from "@/lib/utils/db";
import logger from "@/lib/utils/logger";
import { resolveSupplier, toPublicSupplier } from "@/lib/suppliers/registry";
import { d, roundMoney, computeSellingPrice } from "@/lib/utils/money";
import { cacheDeletePrefix } from "@/lib/cache/cache";
import { realtimeBus } from "@/lib/realtime/bus";
import { ConflictError, NotFoundError, SupplierUnavailableError } from "@/lib/utils/errors";
import { Prisma, ProductStatus } from "@prisma/client";

// In-memory sync lock map to prevent concurrent sync executions per supplier
const activeSyncLocks = new Set<string>();

export interface SyncResult {
  supplierId: string;
  logId: string;
  totalProducts: number;
  newProducts: number;
  updatedProducts: number;
  priceChangedProducts: number;
  deactivatedProducts: number;
  failedProducts: number;
  durationMs: number;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  error?: string;
}

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

export async function testSupplierConnection(supplierId: string) {
  const { supplier, adapter, context } = await resolveSupplier(supplierId);

  try {
    const profile = await adapter.getProfile(context);

    await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        connectionStatus: "CONNECTED",
        connectionError: null,
        lastCheckedAt: new Date(),
      },
    });

    return {
      connected: true,
      profile,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định khi kết nối";
    await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        connectionStatus: "ERROR",
        connectionError: message,
        lastCheckedAt: new Date(),
      },
    });

    throw new SupplierUnavailableError(`Kết nối nhà cung cấp thất bại: ${message}`);
  }
}

export async function syncSupplierProducts(
  supplierId: string,
  trigger: "MANUAL" | "SCHEDULED" | "WEBHOOK" = "MANUAL"
): Promise<SyncResult> {
  if (activeSyncLocks.has(supplierId)) {
    throw new ConflictError("Tiến trình đồng bộ cho nhà cung cấp này đang chạy");
  }

  activeSyncLocks.add(supplierId);
  const startedAt = Date.now();

  const syncLog = await prisma.supplierSyncLog.create({
    data: {
      supplierId,
      trigger,
      status: "RUNNING",
    },
  });

  try {
    const { supplier, adapter, context } = await resolveSupplier(supplierId);
    const result = await adapter.getProducts(context);

    let newProducts = 0;
    let updatedProducts = 0;
    let priceChangedProducts = 0;
    let deactivatedProducts = 0;
    let failedProducts = 0;

    const seenSupplierProductIds = new Set<string>();

    // 1. Process Categories if returned
    const categoryIdMap = new Map<string, string>();
    if (result.categories && result.categories.length > 0) {
      for (const cat of result.categories) {
        const catSlug = slugify(cat.name || cat.id);
        const existingCat = await prisma.category.findFirst({
          where: { OR: [{ slug: catSlug }, { name: cat.name }] },
        });

        if (existingCat) {
          categoryIdMap.set(cat.id, existingCat.id);
        } else {
          try {
            const newCat = await prisma.category.create({
              data: {
                name: cat.name,
                slug: `${catSlug}-${Math.floor(Math.random() * 1000)}`,
              },
            });
            categoryIdMap.set(cat.id, newCat.id);
          } catch (e) {
            logger.warn({ err: e }, "Failed to auto-create category");
          }
        }
      }
    }

    // 2. Process Products
    for (const item of result.products) {
      try {
        seenSupplierProductIds.add(item.supplierProductId);
        const costDecimal = d(item.cost);

        const existingSp = await prisma.supplierProduct.findUnique({
          where: {
            supplierId_supplierProductId: {
              supplierId,
              supplierProductId: item.supplierProductId,
            },
          },
        });

        const previousCost = existingSp ? existingSp.supplierCost : null;
        const isPriceChanged = previousCost !== null && !d(previousCost.toString()).equals(costDecimal);

        const internalCategoryId = item.categoryId ? categoryIdMap.get(item.categoryId) ?? null : null;

        const normalizedStatus: ProductStatus = item.isActive ? "ACTIVE" : "INACTIVE";

        const sp = await prisma.supplierProduct.upsert({
          where: {
            supplierId_supplierProductId: {
              supplierId,
              supplierProductId: item.supplierProductId,
            },
          },
          create: {
            supplierId,
            supplierProductId: item.supplierProductId,
            supplierCategoryId: item.categoryId ?? null,
            supplierCategoryName: item.categoryName ?? null,
            name: item.name,
            description: item.description ?? null,
            image: item.image ?? null,
            supplierCost: costDecimal.toFixed(2),
            previousCost: null,
            stock: item.stock,
            status: item.rawStatus ?? "ACTIVE",
            normalizedStatus,
            isStale: false,
            rawData: item.raw ? JSON.stringify(item.raw) : null,
            lastSyncedAt: new Date(),
            categoryId: internalCategoryId,
          },
          update: {
            name: item.name,
            description: item.description ?? undefined,
            image: item.image ?? undefined,
            supplierCost: costDecimal.toFixed(2),
            previousCost: isPriceChanged ? previousCost : undefined,
            stock: item.stock,
            status: item.rawStatus ?? "ACTIVE",
            normalizedStatus,
            isStale: false,
            rawData: item.raw ? JSON.stringify(item.raw) : undefined,
            lastSyncedAt: new Date(),
            lastChangedAt: isPriceChanged ? new Date() : undefined,
            categoryId: internalCategoryId ?? undefined,
          },
        });

        if (existingSp) {
          updatedProducts++;
          if (isPriceChanged) priceChangedProducts++;
        } else {
          newProducts++;
        }

        // 3. Map or Create Internal Product
        let mapping = await prisma.productSupplierMapping.findFirst({
          where: { supplierProductId: sp.id },
          include: { product: true },
        });

        let product = mapping?.product;

        if (!product) {
          // Check if product with slug exists or create
          const baseSlug = slugify(item.name);
          let candidateSlug = baseSlug || `product-${sp.supplierProductId}`;
          const existingBySlug = await prisma.product.findUnique({ where: { slug: candidateSlug } });
          if (existingBySlug) {
            candidateSlug = `${candidateSlug}-${sp.supplierProductId.toLowerCase().slice(-6)}`;
          }

          const calculatedSelling = computeSellingPrice(
            costDecimal,
            supplier.profitType === "PERCENTAGE" ? "PERCENTAGE" : "FIXED",
            supplier.profitValue.toString()
          );

          product = await prisma.product.create({
            data: {
              name: item.name,
              slug: candidateSlug,
              description: item.description ?? null,
              image: item.image ?? null,
              categoryId: internalCategoryId,
              supplierCost: costDecimal.toFixed(2),
              sellingPrice: calculatedSelling.toFixed(2),
              profitType: supplier.profitType,
              profitValue: supplier.profitValue,
              pricingMode: "AUTO",
              stock: item.stock,
              status: normalizedStatus,
              lastSyncedAt: new Date(),
            },
          });

          await prisma.productSupplierMapping.create({
            data: {
              productId: product.id,
              supplierProductId: sp.id,
              supplierId,
              priority: 100,
              isActive: true,
            },
          });

          await prisma.productPriceHistory.create({
            data: {
              productId: product.id,
              supplierId,
              supplierProductId: sp.id,
              supplierCost: costDecimal.toFixed(2),
              sellingPrice: calculatedSelling.toFixed(2),
              profitAmount: calculatedSelling.minus(costDecimal).toFixed(2),
              profitRate: supplier.profitValue,
              source: "SYNC",
            },
          });
        } else {
          // If product exists and pricingMode is AUTO, recompute selling price if cost changed
          let newSellingPrice = d(product.sellingPrice.toString());
          if (product.pricingMode === "AUTO" && isPriceChanged) {
            newSellingPrice = computeSellingPrice(
              costDecimal,
              product.profitType === "PERCENTAGE" ? "PERCENTAGE" : "FIXED",
              product.profitValue.toString()
            );

            await prisma.productPriceHistory.create({
              data: {
                productId: product.id,
                supplierId,
                supplierProductId: sp.id,
                supplierCost: costDecimal.toFixed(2),
                previousCost: previousCost ? previousCost.toString() : null,
                sellingPrice: newSellingPrice.toFixed(2),
                previousSellingPrice: product.sellingPrice.toString(),
                profitAmount: newSellingPrice.minus(costDecimal).toFixed(2),
                profitRate: product.profitValue,
                source: "SYNC",
              },
            });
          }

          await prisma.product.update({
            where: { id: product.id },
            data: {
              supplierCost: costDecimal.toFixed(2),
              sellingPrice: product.pricingMode === "AUTO" ? newSellingPrice.toFixed(2) : undefined,
              stock: item.stock,
              status: normalizedStatus,
              lastSyncedAt: new Date(),
            },
          });
        }
      } catch (itemErr) {
        logger.error({ err: itemErr, productId: item.supplierProductId }, "Error syncing product item");
        failedProducts++;
      }
    }

    // 4. Mark unseen items as stale (DO NOT delete or mark out of stock)
    if (seenSupplierProductIds.size > 0) {
      await prisma.supplierProduct.updateMany({
        where: {
          supplierId,
          supplierProductId: { notIn: Array.from(seenSupplierProductIds) },
        },
        data: {
          isStale: true,
        },
      });
    }

    const durationMs = Date.now() - startedAt;
    const syncStatus = failedProducts > 0 && newProducts + updatedProducts === 0 ? "FAILED" : failedProducts > 0 ? "PARTIAL" : "SUCCESS";

    await prisma.supplierSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: syncStatus,
        totalProducts: result.products.length,
        newProducts,
        updatedProducts,
        priceChangedProducts,
        deactivatedProducts,
        failedProducts,
        durationMs,
        finishedAt: new Date(),
      },
    });

    await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        lastSyncAt: new Date(),
        lastSyncError: null,
        connectionStatus: "CONNECTED",
      },
    });

    // Invalidate product caches
    await cacheDeletePrefix("cache:products:");
    realtimeBus.publish({ type: "product.synced", supplierId, payload: { syncLogId: syncLog.id } });

    return {
      supplierId,
      logId: syncLog.id,
      totalProducts: result.products.length,
      newProducts,
      updatedProducts,
      priceChangedProducts,
      deactivatedProducts,
      failedProducts,
      durationMs,
      status: syncStatus,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const errorMsg = error instanceof Error ? error.message : "Đồng bộ thất bại";

    await prisma.supplierSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "FAILED",
        durationMs,
        error: errorMsg,
        finishedAt: new Date(),
      },
    });

    await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        lastSyncError: errorMsg,
      },
    });

    throw error;
  } finally {
    activeSyncLocks.delete(supplierId);
  }
}

