import { prisma } from "@/lib/utils/db";
import logger from "@/lib/utils/logger";
import { resolveSupplier } from "@/lib/suppliers/registry";
import { d, computeSellingPrice } from "@/lib/utils/money";
import { invalidateProductCache } from "@/lib/cache/cache";
import { pushEvent } from "@/lib/realtime/bus";
import { ConflictError, SupplierUnavailableError } from "@/lib/utils/errors";
import { ProductStatus } from "@prisma/client";
import { scheduleNextSync } from "@/lib/jobs/sync-settings";

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

    // Sync live balance to SupplierBalance if available
    if (profile && profile.balance !== undefined && profile.balance !== null) {
      await prisma.supplierBalance.upsert({
        where: { supplierId },
        create: {
          supplierId,
          balance: d(profile.balance).toFixed(2),
          balanceType: "ACTUAL",
          lastUpdatedAt: new Date(),
          lastVerifiedAt: new Date(),
        },
        update: {
          balance: d(profile.balance).toFixed(2),
          balanceType: "ACTUAL",
          lastUpdatedAt: new Date(),
          lastVerifiedAt: new Date(),
        },
      });
    }

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

    // Sync live balance to SupplierBalance if supported
    if (adapter.supportsBalance) {
      try {
        const profile = await adapter.getProfile(context);
        if (profile && profile.balance !== undefined && profile.balance !== null) {
          await prisma.supplierBalance.upsert({
            where: { supplierId },
            create: {
              supplierId,
              balance: d(profile.balance).toFixed(2),
              balanceType: "ACTUAL",
              lastUpdatedAt: new Date(),
              lastVerifiedAt: new Date(),
            },
            update: {
              balance: d(profile.balance).toFixed(2),
              balanceType: "ACTUAL",
              lastUpdatedAt: new Date(),
              lastVerifiedAt: new Date(),
            },
          });
        }
      } catch (e) {
        logger.warn({ err: e, supplierId }, "Failed to fetch live balance during sync");
      }
    }

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

        // Explicit stock 0 from supplier = out of stock → hide on storefront.
        // null stock means the supplier does not expose inventory — do not invent OOS.
        const isSupplierActive = supplier.status === "ACTIVE";
        const isOutOfStock = item.stock !== null && item.stock <= 0;
        const normalizedStatus: ProductStatus =
          item.isActive && !isOutOfStock ? "ACTIVE" : "INACTIVE";
        const mappingActive = isSupplierActive && item.isActive && !isOutOfStock;

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
            supplierCategoryId: item.categoryId ?? null,
            supplierCategoryName: item.categoryName ?? null,
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
              status: isSupplierActive ? normalizedStatus : "INACTIVE",
              isHidden: !isSupplierActive,
              lastSyncedAt: new Date(),
            },
          });

          await prisma.productSupplierMapping.create({
            data: {
              productId: product.id,
              supplierProductId: sp.id,
              supplierId,
              priority: 100,
              isActive: mappingActive,
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
          // Keep mapping active only while the SKU is sellable (active + in stock when known).
          if (mapping && mapping.isActive !== mappingActive) {
            await prisma.productSupplierMapping.update({
              where: { id: mapping.id },
              data: { isActive: mappingActive },
            });
          }

          // Mirror content + cost onto the internal product. MANUAL pricing is never overwritten.
          let newSellingPrice = d(product.sellingPrice.toString());
          const shouldReprice = product.pricingMode === "AUTO" && isPriceChanged;
          if (shouldReprice) {
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
          } else if (product.pricingMode === "AUTO" && !isPriceChanged) {
            // Keep selling price consistent with current supplier markup policy.
            newSellingPrice = computeSellingPrice(
              costDecimal,
              product.profitType === "PERCENTAGE" ? "PERCENTAGE" : "FIXED",
              product.profitValue.toString()
            );
          }

          const shouldStayHidden = product.isHidden || !isSupplierActive;
          await prisma.product.update({
            where: { id: product.id },
            data: {
              name: item.name,
              description: item.description ?? undefined,
              image: item.image ?? undefined,
              categoryId: internalCategoryId ?? undefined,
              supplierCost: costDecimal.toFixed(2),
              sellingPrice: product.pricingMode === "AUTO" ? newSellingPrice.toFixed(2) : undefined,
              stock: item.stock,
              status: shouldStayHidden ? "INACTIVE" : normalizedStatus,
              isHidden: shouldStayHidden,
              lastSyncedAt: new Date(),
            },
          });
        }
      } catch (itemErr) {
        logger.error({ err: itemErr, productId: item.supplierProductId }, "Error syncing product item");
        failedProducts++;
      }
    }

    // 4. Mark missing sources as stale and stop selling through them.
    // Do not invent "out of stock" — only deactivate the vanished source mapping.
    if (seenSupplierProductIds.size > 0) {
      const vanished = await prisma.supplierProduct.findMany({
        where: {
          supplierId,
          supplierProductId: { notIn: Array.from(seenSupplierProductIds) },
          isStale: false,
        },
        select: { id: true },
      });

      if (vanished.length > 0) {
        const vanishedIds = vanished.map((v) => v.id);

        await prisma.supplierProduct.updateMany({
          where: { id: { in: vanishedIds } },
          data: { isStale: true, normalizedStatus: "INACTIVE" },
        });

        const mappings = await prisma.productSupplierMapping.findMany({
          where: { supplierProductId: { in: vanishedIds }, isActive: true },
          select: { id: true, productId: true },
        });

        if (mappings.length > 0) {
          await prisma.productSupplierMapping.updateMany({
            where: { id: { in: mappings.map((m) => m.id) } },
            data: { isActive: false },
          });

          const productIds = [...new Set(mappings.map((m) => m.productId))];
          for (const productId of productIds) {
            const stillActive = await prisma.productSupplierMapping.count({
              where: { productId, isActive: true },
            });
            if (stillActive === 0) {
              await prisma.product.update({
                where: { id: productId },
                data: { status: "INACTIVE", lastSyncedAt: new Date() },
              });
              deactivatedProducts++;
            }
          }
        }
      }
    }

    const durationMs = Date.now() - startedAt;
    const syncStatus =
      failedProducts > 0 && newProducts + updatedProducts === 0
        ? "FAILED"
        : failedProducts > 0
          ? "PARTIAL"
          : "SUCCESS";

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

    await scheduleNextSync(supplierId);

    await invalidateProductCache();
    pushEvent({
      type: "product.synced",
      supplierId,
      payload: {
        syncLogId: syncLog.id,
        totalProducts: result.products.length,
        newProducts,
        updatedProducts,
        priceChangedProducts,
        deactivatedProducts,
      },
    });
    pushEvent({
      type: "sync.status",
      supplierId,
      payload: { syncLogId: syncLog.id, status: syncStatus, durationMs },
    });

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

    // Back off even on failure so the scheduler does not hammer a broken API.
    await scheduleNextSync(supplierId).catch(() => undefined);

    pushEvent({
      type: "sync.status",
      supplierId,
      payload: { syncLogId: syncLog.id, status: "FAILED", error: errorMsg },
    });

    throw error;
  } finally {
    activeSyncLocks.delete(supplierId);
  }
}

