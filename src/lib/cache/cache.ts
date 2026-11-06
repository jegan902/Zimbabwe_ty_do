import { redis } from "@/lib/utils/redis";
import { d, roundMoney } from "@/lib/utils/money";

/**
 * Cache helpers.
 *
 * Redis is used for two distinct jobs:
 *  - cached read models (product listings, dashboard counters), invalidated on write
 *  - distributed locks / rate limiting, which must fail closed
 *
 * Cache reads degrade gracefully (a Redis outage simply means a database read),
 * while lock acquisition fails closed so two sync jobs can never run at once.
 */

const DEFAULT_TTL_SECONDS = 60;

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = DEFAULT_TTL_SECONDS) {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Cache writes are best-effort; the database is the source of truth.
  }
}

export async function cacheDelete(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch {
    // Ignored: a stale cache entry expires on its own TTL.
  }
}

/** Deletes every key matching a prefix using SCAN, never KEYS. */
export async function cacheDeletePrefix(prefix: string): Promise<void> {
  try {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 200);
      cursor = next;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== "0");
  } catch {
    // Ignored on purpose.
  }
}

export const CACHE_KEYS = {
  productList: "cache:products:list",
  productDetail: "cache:product:",
  categories: "cache:categories",
  homeStats: "cache:home:stats",
  adminDashboard: "cache:admin:dashboard:",
} as const;

export async function invalidateProductCache(productId?: string, slug?: string) {
  await cacheDeletePrefix(CACHE_KEYS.productList);
  await cacheDeletePrefix(CACHE_KEYS.categories);
  await cacheDeletePrefix(`${CACHE_KEYS.adminDashboard}`);
  if (productId) await cacheDelete(`${CACHE_KEYS.productDetail}${productId}`);
  if (slug) await cacheDelete(`${CACHE_KEYS.productDetail}slug:${slug}`);
}

export async function invalidateProductSlugCache(slug: string) {
  await cacheDelete(`${CACHE_KEYS.productDetail}slug:${slug}`);
}

/**
 * Acquires a short-lived distributed lock. Returns the lock token on success and
 * null when another worker already holds it, so jobs never overlap.
 */
export async function acquireLock(
  name: string,
  ttlSeconds = 300
): Promise<string | null> {
  const token = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  try {
    const result = await redis.set(`lock:${name}`, token, "EX", ttlSeconds, "NX");
    return result === "OK" ? token : null;
  } catch (error) {
    // Fail closed: without Redis we cannot prove exclusivity, so do not run.
    throw new Error(`Cannot acquire lock ${name}: ${(error as Error).message}`);
  }
}

export async function releaseLock(name: string, token: string): Promise<void> {
  try {
    const current = await redis.get(`lock:${name}`);
    if (current === token) await redis.del(`lock:${name}`);
  } catch {
    // The lock expires on its own TTL.
  }
}

export async function withLock<T>(
  name: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<{ acquired: boolean; result?: T }> {
  const token = await acquireLock(name, ttlSeconds);
  if (!token) return { acquired: false };
  try {
    const result = await fn();
    return { acquired: true, result };
  } finally {
    await releaseLock(name, token);
  }
}

/** Monetary cache helpers keep the string representation stable across writes. */
export function cacheMoney(value: string | number): string {
  return roundMoney(d(value)).toFixed(2);
}