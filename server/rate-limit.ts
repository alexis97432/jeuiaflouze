/** Seau à jetons par clé (adresse + action) : quotas simples, en mémoire, bornés. */
export type RateLimiter = { take(key: string, now: number): boolean };

export function createRateLimiter(capacity: number, refillPerMinute: number, maxKeys = 10_000): RateLimiter {
  const buckets = new Map<string, { tokens: number; at: number }>();
  return {
    take(key, now) {
      let b = buckets.get(key);
      if (!b) {
        if (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value as string);
        b = { tokens: capacity, at: now };
        buckets.set(key, b);
      }
      b.tokens = Math.min(capacity, b.tokens + ((now - b.at) / 60_000) * refillPerMinute);
      b.at = now;
      if (b.tokens < 1) return false;
      b.tokens -= 1;
      return true;
    },
  };
}
