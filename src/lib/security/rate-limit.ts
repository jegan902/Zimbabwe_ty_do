import crypto from "crypto";
import { redis } from "../utils/redis";
import { AppError } from "../utils/errors";
import logger from "../utils/logger";

/** Consecutive storage failures before the breaker opens. */
const FAILURE_THRESHOLD = 5;
/** How long requests are rejected without touching Redis once the breaker is open. */
const BREAKER_OPEN_MS = 30_000;

let consecutiveFailures = 0;
let breakerOpenUntil = 0;

function storageUnavailable(): AppError {
  return new AppError(
    503,
    "RATE_LIMIT_UNAVAILABLE",
    "Không kiểm tra được giới hạn truy cập, vui lòng thử lại sau",
  );
}

/**
 * Counts a storage failure and opens the breaker once failures pile up.
 *
 * Without the breaker every request would wait for the Redis timeout while the
 * store is down; with it the cost is paid a few times and then requests are
 * rejected immediately, still failing closed.
 */
function recordStorageFailure(err: unknown): AppError {
  consecutiveFailures += 1;

  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    breakerOpenUntil = Date.now() + BREAKER_OPEN_MS;
    consecutiveFailures = 0;
    logger.error(
      { err },
      `Rate limit storage unavailable ${FAILURE_THRESHOLD}x, rejecting requests for ${BREAKER_OPEN_MS / 1000}s`,
    );
  } else {
    logger.error({ err }, "Rate limit storage unavailable");
  }

  return storageUnavailable();
}

/**
 * Fixed-window counter in Redis. Throws 429 once `limit` is exceeded within `windowSeconds`.
 *
 * Fails closed: if Redis is unreachable the request is rejected with
 * `503 RATE_LIMIT_UNAVAILABLE` (and the breaker short-circuits subsequent calls)
 * instead of silently losing rate limiting. Development keeps the permissive path
 * so a local session without Redis still works.
 */
export async function consumeRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  if (Date.now() < breakerOpenUntil) throw storageUnavailable();

  try {
    const key = `rl:${scope}:${crypto.createHash("sha256").update(identifier).digest("hex")}`;

    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }

    // A successful round-trip means the store recovered.
    consecutiveFailures = 0;
    breakerOpenUntil = 0;

    if (count > limit) {
      const ttl = await redis.ttl(key);
      const retryAfterSeconds = ttl > 0 ? ttl : windowSeconds;
      throw new AppError(
        429,
        "RATE_LIMITED",
        "Too many requests. Try again later.",
        {
          retryAfterSeconds,
        },
      );
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (process.env.NODE_ENV === "development") {
      return;
    }
    throw recordStorageFailure(err);
  }
}

/**
 * Same fixed window as `consumeRateLimit`, but a storage outage is logged instead of
 * propagated. Use it on public read-only paths where losing Redis must not take the
 * storefront down; keep the fail-closed variant for auth and money paths.
 */
export async function consumeRateLimitSoft(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  try {
    await consumeRateLimit(scope, identifier, limit, windowSeconds);
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 429) throw err;
    logger.error(
      { err, scope },
      "Rate limit storage unavailable, request allowed",
    );
  }
}
