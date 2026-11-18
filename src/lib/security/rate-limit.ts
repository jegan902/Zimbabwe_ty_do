import crypto from "crypto";
import { redis } from "../utils/redis";
import { AppError } from "../utils/errors";
import logger from "../utils/logger";

/**
 * Fixed-window counter in Redis. Throws 429 once `limit` is exceeded within `windowSeconds`.
 * If Redis is unreachable the error propagates, so requests fail closed instead of
 * silently losing rate limiting.
 */
export async function consumeRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  try {
    const key = `rl:${scope}:${crypto.createHash("sha256").update(identifier).digest("hex")}`;

    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }

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
    throw err;
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
