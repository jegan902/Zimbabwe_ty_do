import { redis } from "@/lib/utils/redis";

/**
 * Liveness of the supplier sync worker.
 *
 * `/api/health` cannot tell "no supplier is due" from "the scheduler died", and a
 * dead scheduler is invisible: orders keep flowing, only the catalog freezes. The
 * worker therefore leaves a short-lived key behind on every tick; a missing key is
 * a hard signal that nothing is driving the schedule.
 *
 * TTL is 3 ticks so one slow tick does not flap the health check.
 */
export const SYNC_WORKER_HEARTBEAT_KEY = "worker:supplier-sync:heartbeat";
export const SYNC_WORKER_HEARTBEAT_TTL_SECONDS = 180;
/** A heartbeat older than this (in seconds) is reported as unhealthy. */
export const SYNC_WORKER_STALE_AFTER_SECONDS = 120;

export interface SyncWorkerHeartbeat {
  at: string;
  pid: number;
}

/** Best effort on purpose: monitoring must never break the sync loop. */
export async function recordSyncWorkerHeartbeat(): Promise<void> {
  const payload: SyncWorkerHeartbeat = { at: new Date().toISOString(), pid: process.pid };
  try {
    await redis.set(
      SYNC_WORKER_HEARTBEAT_KEY,
      JSON.stringify(payload),
      "EX",
      SYNC_WORKER_HEARTBEAT_TTL_SECONDS,
    );
  } catch {
    // Redis down: the health endpoint already reports Redis as unhealthy.
  }
}

export async function readSyncWorkerHeartbeat(): Promise<SyncWorkerHeartbeat | null> {
  try {
    const raw = await redis.get(SYNC_WORKER_HEARTBEAT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SyncWorkerHeartbeat;
    return parsed && typeof parsed.at === "string" ? parsed : null;
  } catch {
    return null;
  }
}
