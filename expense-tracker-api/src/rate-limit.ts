type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

export function createRateLimiter({ limit, windowMs }: RateLimitOptions) {
  const hits = new Map<string, number[]>();

  return {
    allow(key: string, now = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}
