import crypto from 'crypto';
import { redis } from '../utils/redis';
import { AppError } from '../utils/errors';

/**
 * Fixed-window counter in Redis. Throws 429 once `limit` is exceeded within `windowSeconds`.
 * If Redis is unreachable the error propagates, so requests fail closed instead of
 * silently losing rate limiting.
 */
export async function consumeRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<void> {
  try {
    const key = `rl:${scope}:${crypto.createHash('sha256').update(identifier).digest('hex')}`;

    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }

    if (count > limit) {
      const ttl = await redis.ttl(key);
      const retryAfterSeconds = ttl > 0 ? ttl : windowSeconds;
      throw new AppError(429, 'RATE_LIMITED', 'Too many requests. Try again later.', {
        retryAfterSeconds,
      });
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (process.env.NODE_ENV === 'development') {
      return;
    }
    throw err;
  }
}
