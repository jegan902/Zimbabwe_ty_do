import { prisma } from "@/lib/utils/db";
import logger from "@/lib/utils/logger";
import { syncSupplierProducts } from "@/lib/services/supplier.service";
import { withLock } from "@/lib/cache/cache";
import {
  ensureSupplierSyncSettings,
  scheduleNextSync,
} from "@/lib/jobs/sync-settings";

export {
  SYNC_INTERVAL_OPTIONS,
  DEFAULT_SYNC_INTERVAL,
  normalizeSyncInterval,
  ensureSupplierSyncSettings,
  scheduleNextSync,
} from "@/lib/jobs/sync-settings";

/**
 * Find ACTIVE suppliers with auto-sync due and run sync (with Redis lock).
 */
export async function runDueSupplierSyncs(): Promise<{
  checked: number;
  ran: number;
  skipped: number;
  failed: number;
}> {
  await ensureSupplierSyncSettings();

  const now = new Date();
  const due = await prisma.supplier.findMany({
    where: {
      status: "ACTIVE",
      syncSettings: {
        is: {
          isAutoSyncEnabled: true,
          OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: now } }],
        },
      },
    },
    select: {
      id: true,
      name: true,
      syncSettings: { select: { syncInterval: true } },
    },
  });

  let ran = 0;
  let skipped = 0;
  let failed = 0;

  for (const supplier of due) {
    const lockName = `supplier-sync:${supplier.id}`;
    try {
      const { acquired, result } = await withLock(lockName, 280, async () => {
        const outcome = await syncSupplierProducts(supplier.id, "SCHEDULED");
        await scheduleNextSync(supplier.id, supplier.syncSettings?.syncInterval);
        return outcome;
      });

      if (!acquired) {
        skipped += 1;
        logger.info({ supplierId: supplier.id }, "Auto-sync skipped: lock held");
        continue;
      }

      ran += 1;
      logger.info(
        {
          supplierId: supplier.id,
          name: supplier.name,
          status: result?.status,
          total: result?.totalProducts,
        },
        "Auto-sync finished"
      );
    } catch (err) {
      failed += 1;
      await scheduleNextSync(supplier.id, supplier.syncSettings?.syncInterval).catch(
        () => undefined
      );
      logger.error({ err, supplierId: supplier.id }, "Auto-sync failed");
    }
  }

  return { checked: due.length, ran, skipped, failed };
}

let inProcessTimer: NodeJS.Timeout | null = null;

export function initInProcessSyncWorker(intervalMs = 30_000) {
  if (inProcessTimer) return;
  logger.info("[AutoSync] In-process supplier sync worker started");

  // Initial check after 3 seconds
  setTimeout(() => {
    runDueSupplierSyncs().catch((err) =>
      logger.error({ err }, "Initial in-process supplier sync check failed")
    );
  }, 3_000);

  inProcessTimer = setInterval(async () => {
    try {
      const summary = await runDueSupplierSyncs();
      if (summary.ran > 0) {
        logger.info(
          { summary },
          `[AutoSync] Completed auto-sync for ${summary.ran} due suppliers`
        );
      }
    } catch (err) {
      logger.error({ err }, "[AutoSync] In-process supplier sync tick failed");
    }
  }, intervalMs);
}

