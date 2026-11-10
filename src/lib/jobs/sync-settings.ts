import { prisma } from "@/lib/utils/db";

/** Allowed auto-sync intervals (seconds). */
export const SYNC_INTERVAL_OPTIONS = [60, 300, 900, 1800, 3600] as const;
export const DEFAULT_SYNC_INTERVAL = 300;

export function normalizeSyncInterval(seconds: number): number {
  if (SYNC_INTERVAL_OPTIONS.includes(seconds as (typeof SYNC_INTERVAL_OPTIONS)[number])) {
    return seconds;
  }
  return DEFAULT_SYNC_INTERVAL;
}

/** Ensure every ACTIVE supplier has sync settings (auto on, 5 minutes). */
export async function ensureSupplierSyncSettings(): Promise<void> {
  const suppliers = await prisma.supplier.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, syncSettings: { select: { id: true } } },
  });

  const now = new Date();
  for (const supplier of suppliers) {
    if (supplier.syncSettings) continue;
    await prisma.supplierSyncSettings.create({
      data: {
        supplierId: supplier.id,
        syncInterval: DEFAULT_SYNC_INTERVAL,
        isAutoSyncEnabled: true,
        nextSyncAt: now,
      },
    });
  }
}

export async function scheduleNextSync(supplierId: string, intervalSeconds?: number) {
  const existing = await prisma.supplierSyncSettings.findUnique({
    where: { supplierId },
  });
  const interval = normalizeSyncInterval(
    intervalSeconds ?? existing?.syncInterval ?? DEFAULT_SYNC_INTERVAL
  );
  const nextSyncAt = new Date(Date.now() + interval * 1000);

  await prisma.supplierSyncSettings.upsert({
    where: { supplierId },
    create: {
      supplierId,
      syncInterval: interval,
      isAutoSyncEnabled: true,
      nextSyncAt,
    },
    update: {
      syncInterval: interval,
      nextSyncAt,
    },
  });
}
