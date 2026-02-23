type Bucket = {
  failures: number;
  blockedUntil: number;
  windowStart: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

function nowMs(): number {
  return Date.now();
}

function getOrCreateBucket(key: string): Bucket {
  const existing = buckets.get(key);
  if (existing) return existing;
  const created: Bucket = { failures: 0, blockedUntil: 0, windowStart: nowMs() };
  buckets.set(key, created);
  return created;
}

export function checkRateLimit(key: string): RateLimitResult {
  const bucket = getOrCreateBucket(key);
  const now = nowMs();

  if (bucket.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1000)),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function registerFailure(key: string, opts?: { maxFailures?: number; blockSeconds?: number; windowSeconds?: number }) {
  const maxFailures = opts?.maxFailures ?? 5;
  const blockSeconds = opts?.blockSeconds ?? 900;
  const windowSeconds = opts?.windowSeconds ?? 900;
  const windowMs = windowSeconds * 1000;

  const bucket = getOrCreateBucket(key);
  const now = nowMs();

  if (now - bucket.windowStart > windowMs) {
    bucket.failures = 0;
    bucket.windowStart = now;
    bucket.blockedUntil = 0;
  }

  bucket.failures += 1;
  if (bucket.failures >= maxFailures) {
    bucket.blockedUntil = now + blockSeconds * 1000;
    bucket.failures = 0;
    bucket.windowStart = now;
  }
}

export function registerSuccess(key: string) {
  buckets.delete(key);
}
