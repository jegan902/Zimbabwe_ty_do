import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/db";
import { redis } from "@/lib/utils/redis";
import { envBool } from "@/lib/env";
import {
  readSyncWorkerHeartbeat,
  SYNC_WORKER_STALE_AFTER_SECONDS,
} from "@/lib/jobs/worker-heartbeat";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public liveness/readiness probe for an external uptime monitor
 * (UptimeRobot, Better Stack, Pingdom, a cron + curl...).
 *
 * - 200 `ok`        everything that should be alive is alive
 * - 503 `degraded`  database or cache reachable, but the catalog pipeline is not
 * - 503 `error`     database or cache unreachable — the shop cannot serve
 *
 * The body is intentionally aggregate-only: it is reachable without a session, so
 * it must not leak supplier names, balances or error strings.
 */

const PROCESS_STARTED_AT = Date.now();
/** A fresh instance must not be reported dead before its first worker tick. */
const STARTUP_GRACE_SECONDS = 60;
const CHECK_TIMEOUT_MS = 2_500;

interface CheckResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms).unref?.(),
  );
}

async function probe(fn: () => Promise<unknown>): Promise<CheckResult> {
  const started = Date.now();
  try {
    await Promise.race([fn(), timeout(CHECK_TIMEOUT_MS)]);
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message.slice(0, 200) : "unknown error",
    };
  }
}

export async function GET() {
  const [database, cache] = await Promise.all([
    probe(() => prisma.$queryRaw`SELECT 1`),
    probe(() => redis.ping()),
  ]);

  // Catalog signals. Counts only: cheap enough to run on every monitor ping.
  let activeSuppliers = 0;
  let suppliersWithLastError = 0;
  let lastSyncAt: string | null = null;
  let lastSyncStatus: string | null = null;
  if (database.ok) {
    try {
      const [suppliers, withError, lastRun] = await Promise.all([
        prisma.supplier.count({ where: { status: "ACTIVE" } }),
        prisma.supplier.count({ where: { status: "ACTIVE", lastSyncError: { not: null } } }),
        prisma.supplierSyncLog.findFirst({
          orderBy: { startedAt: "desc" },
          select: { status: true, startedAt: true },
        }),
      ]);
      activeSuppliers = suppliers;
      suppliersWithLastError = withError;
      lastSyncAt = lastRun?.startedAt.toISOString() ?? null;
      lastSyncStatus = lastRun?.status ?? null;
    } catch {
      // A failing aggregate while `SELECT 1` works is a degraded catalog, not a
      // reason to hide the database result.
    }
  }

  const expectWorker = envBool("HEALTH_EXPECT_SYNC_WORKER", true);
  const heartbeat = expectWorker && cache.ok ? await readSyncWorkerHeartbeat() : null;
  const heartbeatAgeSeconds = heartbeat
    ? Math.max(0, Math.round((Date.now() - new Date(heartbeat.at).getTime()) / 1000))
    : null;
  const uptimeSeconds = Math.round((Date.now() - PROCESS_STARTED_AT) / 1000);

  const workerOk = !expectWorker
    ? true
    : !cache.ok
      ? false // without Redis the heartbeat cannot be verified
      : heartbeatAgeSeconds !== null
        ? heartbeatAgeSeconds <= SYNC_WORKER_STALE_AFTER_SECONDS
        : uptimeSeconds < STARTUP_GRACE_SECONDS;

  const catalogOk = database.ok && suppliersWithLastError === 0;
  const healthy = database.ok && cache.ok && workerOk && catalogOk;

  const body = {
    status: !database.ok || !cache.ok ? "error" : healthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds,
    checks: {
      database,
      redis: cache,
      syncWorker: {
        ok: workerOk,
        expected: expectWorker,
        lastHeartbeatAt: heartbeat?.at ?? null,
        ageSeconds: heartbeatAgeSeconds,
        staleAfterSeconds: SYNC_WORKER_STALE_AFTER_SECONDS,
      },
      catalog: {
        ok: catalogOk,
        activeSuppliers,
        suppliersWithLastError,
        lastSyncAt,
        lastSyncStatus,
      },
    },
  };

  return NextResponse.json(body, {
    status: healthy ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
