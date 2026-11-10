/**
 * Long-running auto-sync worker.
 *
 * Polls every TICK_MS for suppliers whose nextSyncAt is due
 * (default interval per supplier: 300s / 5 minutes).
 *
 * Usage:
 *   npm run worker:sync
 *
 * Keep this process running alongside `npm run dev` (second terminal)
 * or under a process manager in production.
 */
import "dotenv/config";
import { redis } from "../src/lib/utils/redis";
import { prisma } from "../src/lib/utils/db";
import { runDueSupplierSyncs } from "../src/lib/jobs/supplier-sync.scheduler";

const TICK_MS = Number(process.env.SYNC_WORKER_TICK_MS || 30_000);

async function tick() {
  try {
    if (redis.status !== "ready") {
      await redis.connect().catch(() => undefined);
    }
    const summary = await runDueSupplierSyncs();
    if (summary.checked > 0) {
      console.log(
        `[sync-worker] due=${summary.checked} ran=${summary.ran} skipped=${summary.skipped} failed=${summary.failed}`
      );
    }
  } catch (err) {
    console.error("[sync-worker] tick error:", err instanceof Error ? err.message : err);
  }
}

async function main() {
  console.log(`[sync-worker] started — tick every ${TICK_MS}ms`);
  console.log("[sync-worker] Suppliers with isAutoSyncEnabled use syncInterval (default 300s)");

  await tick();
  const timer = setInterval(tick, TICK_MS);

  const shutdown = async () => {
    clearInterval(timer);
    console.log("[sync-worker] shutting down…");
    await prisma.$disconnect().catch(() => undefined);
    await redis.quit().catch(() => undefined);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
