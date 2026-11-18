/**
 * Next.js instrumentation hook: runs once per server instance, before the first
 * request is served.
 *
 * The supplier sync worker is started here so a plain `npm run dev` / `npm start`
 * keeps the catalog syncing (and the low-balance alert scan ticking) without a
 * second terminal running `npm run worker:sync`.
 *
 * Set SYNC_WORKER_ENABLED=false on extra instances (PM2 cluster, containers) when
 * only one process should own the schedule. The Redis locks still prevent
 * duplicate work, but each process would otherwise run its own timer.
 */
export async function register() {
  // Prisma and the Redis client only work in the Node.js runtime.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const enabled = (process.env.SYNC_WORKER_ENABLED ?? "true").toLowerCase();
  if (["0", "false", "no", "off"].includes(enabled)) return;

  const { initInProcessSyncWorker } =
    await import("@/lib/jobs/supplier-sync.scheduler");
  initInProcessSyncWorker();
}
