import { acquireLock } from "@/lib/cache/cache";
import { prisma } from "@/lib/utils/db";
import logger from "@/lib/utils/logger";
import { sendAdminAlert } from "./notification.service";

/**
 * Health of the supplier sync pipeline.
 *
 * The low-balance alert answers "do we still have money at the supplier?"; this
 * one answers "is the catalog still being refreshed at all?". A supplier whose
 * API silently starts returning 401 refreshes nothing while every order keeps
 * working, which is exactly the failure that goes unnoticed for days.
 */

/** Consecutive FAILED sync runs that make a supplier count as broken. */
export const SYNC_FAILURE_ALERT_THRESHOLD = 3;
/** No successful sync for this long (while auto-sync is on) also counts as broken. */
export const STALE_SYNC_HOURS = 12;
/** The whole scan runs at most once per interval, across all workers. */
const HEALTH_SCAN_INTERVAL_SECONDS = 300;
/** One email per supplier per window; this is a reminder cadence, not a storm. */
const ALERT_DEDUPE_BUCKET_MINUTES = 6 * 60;
/** How many recent runs are inspected to count consecutive failures. */
const RECENT_LOG_WINDOW = 25;

export interface SupplierHealthRow {
  id: string;
  name: string;
  connectionStatus: string;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
  lastSuccessAt: Date | null;
  consecutiveFailures: number;
  autoSyncEnabled: boolean;
  /** Hours since the last successful run, null when it never succeeded. */
  hoursSinceSuccess: number | null;
  healthy: boolean;
  reasons: string[];
}

export interface SyncHealthSummary {
  checked: number;
  unhealthy: number;
  alerted: number;
  suppressed: number;
  skipped: number;
  failed: number;
  suppliers: Array<{
    name: string;
    consecutiveFailures: number;
    hoursSinceSuccess: number | null;
  }>;
}

function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 3_600_000;
}

/**
 * Reads the recent sync history of every ACTIVE supplier.
 * Used by the alert scan and by `GET /api/health`.
 */
export async function getSupplierHealth(): Promise<SupplierHealthRow[]> {
  const suppliers = await prisma.supplier.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      connectionStatus: true,
      lastSyncAt: true,
      lastSyncError: true,
      syncSettings: { select: { isAutoSyncEnabled: true } },
    },
    orderBy: { name: "asc" },
  });

  const now = new Date();

  return Promise.all(
    suppliers.map(async (supplier) => {
      const [recentRuns, lastSuccess] = await Promise.all([
        prisma.supplierSyncLog.findMany({
          where: { supplierId: supplier.id, status: { in: ["SUCCESS", "PARTIAL", "FAILED"] } },
          orderBy: { startedAt: "desc" },
          take: RECENT_LOG_WINDOW,
          select: { status: true },
        }),
        prisma.supplierSyncLog.findFirst({
          where: { supplierId: supplier.id, status: { in: ["SUCCESS", "PARTIAL"] } },
          orderBy: { startedAt: "desc" },
          select: { startedAt: true },
        }),
      ]);

      let consecutiveFailures = 0;
      for (const run of recentRuns) {
        if (run.status !== "FAILED") break;
        consecutiveFailures += 1;
      }

      const lastSuccessAt = lastSuccess?.startedAt ?? null;
      const hoursSinceSuccess = lastSuccessAt ? hoursBetween(lastSuccessAt, now) : null;
      const autoSyncEnabled = Boolean(supplier.syncSettings?.isAutoSyncEnabled);

      const reasons: string[] = [];
      if (consecutiveFailures >= SYNC_FAILURE_ALERT_THRESHOLD) {
        reasons.push(`${consecutiveFailures} lần đồng bộ lỗi liên tiếp`);
      }
      // A supplier that never synced yet is not "stale" — it has not been due.
      if (autoSyncEnabled && hoursSinceSuccess !== null && hoursSinceSuccess >= STALE_SYNC_HOURS) {
        reasons.push(`không đồng bộ thành công ${Math.floor(hoursSinceSuccess)} giờ`);
      }

      return {
        id: supplier.id,
        name: supplier.name,
        connectionStatus: supplier.connectionStatus,
        lastSyncAt: supplier.lastSyncAt,
        lastSyncError: supplier.lastSyncError,
        lastSuccessAt,
        consecutiveFailures,
        autoSyncEnabled,
        hoursSinceSuccess,
        healthy: reasons.length === 0,
        reasons,
      };
    }),
  );
}

function formatDateTime(value: Date | null): string {
  if (!value) return "chưa từng";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

/**
 * Emails the admin about suppliers that are failing or have gone stale.
 * Deduplication makes the scan idempotent: each supplier produces at most one
 * email per window, no matter how often the scheduler ticks.
 */
export async function checkSupplierSyncHealth(): Promise<SyncHealthSummary> {
  const rows = await getSupplierHealth();
  const broken = rows.filter((row) => !row.healthy);

  const summary: SyncHealthSummary = {
    checked: rows.length,
    unhealthy: broken.length,
    alerted: 0,
    suppressed: 0,
    skipped: 0,
    failed: 0,
    suppliers: broken.map((row) => ({
      name: row.name,
      consecutiveFailures: row.consecutiveFailures,
      hoursSinceSuccess: row.hoursSinceSuccess,
    })),
  };

  if (broken.length === 0) return summary;

  const bucket = Math.floor(Date.now() / (ALERT_DEDUPE_BUCKET_MINUTES * 60_000));

  for (const row of broken) {
    const result = await sendAdminAlert({
      supplierId: row.id,
      type: "SUPPLIER_SYNC_FAILURE",
      subject: `[CẢNH BÁO] Đồng bộ nhà cung cấp ${row.name} đang lỗi`,
      body: [
        "Kính gửi Admin,",
        "",
        `Đồng bộ sản phẩm từ nhà cung cấp ${row.name} đang gặp sự cố: ${row.reasons.join("; ")}.`,
        "",
        `- Lần đồng bộ thành công gần nhất: ${formatDateTime(row.lastSuccessAt)}`,
        `- Lần đồng bộ gần nhất: ${formatDateTime(row.lastSyncAt)}`,
        `- Trạng thái kết nối: ${row.connectionStatus}`,
        `- Lỗi gần nhất: ${row.lastSyncError?.slice(0, 500) || "không có thông tin"}`,
        "",
        "Đơn hàng mới vẫn được xử lý trực tiếp qua API nhà cung cấp, nhưng giá và tồn kho trên web có thể đã cũ.",
        "Vui lòng kiểm tra API key / IP whitelist và trạng thái nhà cung cấp tại /admin/sync.",
        "",
        "Email này được gửi lại tối đa 6 giờ một lần cho tới khi đồng bộ thành công trở lại.",
        "",
        "Trân trọng,",
        "Hệ thống",
      ].join("\n"),
      dedupeKey: `supplier-sync-failure-${row.id}-${bucket}`,
    });

    switch (result.status) {
      case "SENT":
        summary.alerted += 1;
        break;
      case "DUPLICATE":
        summary.suppressed += 1;
        break;
      case "SKIPPED":
        summary.skipped += 1;
        break;
      default:
        summary.failed += 1;
    }
  }

  logger.info({ summary }, "Supplier sync health scan finished");
  return summary;
}

/**
 * Throttled entry point for the scheduler. The lock is intentionally not
 * released: its TTL is the scan interval, so a 30s sync tick does not turn into
 * a 30s health scan (and a 30s mail check).
 */
export async function runSupplierSyncHealthAlertsThrottled(
  intervalSeconds = HEALTH_SCAN_INTERVAL_SECONDS,
): Promise<{ ran: boolean; summary?: SyncHealthSummary }> {
  try {
    const token = await acquireLock("supplier-sync-health", intervalSeconds);
    if (!token) return { ran: false };
    const summary = await checkSupplierSyncHealth();
    return { ran: true, summary };
  } catch (err) {
    // Never let monitoring break the sync loop itself.
    logger.error({ err }, "Supplier sync health scan failed");
    return { ran: false };
  }
}
