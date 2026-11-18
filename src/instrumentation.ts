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

  await assertEncryptionKeyConfigured();

  const enabled = (process.env.SYNC_WORKER_ENABLED ?? "true").toLowerCase();
  if (["0", "false", "no", "off"].includes(enabled)) return;

  const { initInProcessSyncWorker } =
    await import("@/lib/jobs/supplier-sync.scheduler");
  initInProcessSyncWorker();
}

/**
 * Supplier credentials and partner API keys are encrypted with ENCRYPTION_KEY; when
 * it is missing the app quietly derives one from SESSION_SECRET. That keeps existing
 * data readable but makes a SESSION_SECRET rotation destructive, so the state is
 * reported loudly at every boot instead of being discovered later.
 */
async function assertEncryptionKeyConfigured(): Promise<void> {
  const key = process.env.ENCRYPTION_KEY;
  if (key && /^[0-9a-fA-F]{64}$/.test(key)) return;

  const logger = (await import("@/lib/utils/logger")).default;
  const message = key
    ? "ENCRYPTION_KEY không hợp lệ: phải đúng 64 ký tự hex (openssl rand -hex 32). Đang dùng khoá suy ra từ SESSION_SECRET."
    : "ENCRYPTION_KEY chưa được cấu hình: credential nhà cung cấp và API key partner đang được mã hoá bằng khoá suy ra từ SESSION_SECRET. Đặt ENCRYPTION_KEY trước khi đổi SESSION_SECRET.";

  if (process.env.NODE_ENV === "production") {
    logger.error(message);
  } else {
    logger.warn(message);
  }
}
