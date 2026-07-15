// Minimal in-memory rate limiter for auth endpoints (login, register, forgot
// password). Per-process only — good enough locally and as a first line on a
// single instance. CLOUD SWAP: use Upstash Ratelimit or the Vercel WAF for a
// shared, durable limit (see README).

const buckets = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 10;

/** Returns true if the caller identified by `key` is over the limit. */
export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  if (buckets.size > 10_000) buckets.clear(); // crude memory cap
  return bucket.count > MAX_PER_WINDOW;
}
