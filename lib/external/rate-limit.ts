/**
 * In-memory token buckets for a single-instance server: one global bucket and
 * one per client. A request passes only when both buckets hold a token.
 */

interface Bucket {
  tokens: number;
  at: number;
}

export interface BucketConfig {
  capacity: number;
  /** Milliseconds to refill one token. */
  refillMs: number;
}

export interface RateLimiter {
  tryTake: (clientId: string) => boolean;
}

const MAX_CLIENTS = 1000;
const GLOBAL = "\u0000global";

export const createRateLimiter = ({
  global,
  perClient,
}: {
  global: BucketConfig;
  perClient: BucketConfig;
}): RateLimiter => {
  const buckets = new Map<string, Bucket>();

  const refill = (key: string, config: BucketConfig, now: number): Bucket => {
    const prev = buckets.get(key);
    if (!prev) return { tokens: config.capacity, at: now };
    const gained = (now - prev.at) / config.refillMs;
    return { tokens: Math.min(config.capacity, prev.tokens + gained), at: now };
  };

  const store = (key: string, bucket: Bucket): void => {
    buckets.delete(key);
    buckets.set(key, bucket);
    for (const oldest of buckets.keys()) {
      if (buckets.size <= MAX_CLIENTS + 1) return;
      if (oldest !== GLOBAL) buckets.delete(oldest);
    }
  };

  return {
    tryTake: (clientId) => {
      const now = Date.now();
      const key = `client:${clientId}`;
      const g = refill(GLOBAL, global, now);
      const c = refill(key, perClient, now);
      const allowed = g.tokens >= 1 && c.tokens >= 1;
      const spend = allowed ? 1 : 0;
      store(GLOBAL, { ...g, tokens: g.tokens - spend });
      store(key, { ...c, tokens: c.tokens - spend });
      return allowed;
    },
  };
};

/** Scout limits: the global bucket caps Tavily spend whatever the client id. */
export const scoutRateLimiter = createRateLimiter({
  global: { capacity: 20, refillMs: 6000 },
  perClient: { capacity: 5, refillMs: 20000 },
});

/** First X-Forwarded-For hop, else X-Real-IP; spoofable, so the global bucket is the real cap. */
export const clientIdOf = (request: Request): string =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip")?.trim() ||
  "unknown";
