export interface Limit { capacity: number; perSecond: number }
interface Bucket { tokens: number; updated: number }
/** Fixed storage bound; full storage fails closed instead of evicting live limits. */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private sweep: IterableIterator<[string, Bucket]> | undefined;
  constructor(private maxEntries = 10000, private now = () => performance.now()) {}
  get size() { return this.buckets.size; }
  take(key: string, limit: Limit): { seconds: number; full: boolean } | null {
    const now = this.now();
    this.sweep ??= this.buckets.entries();
    for (let i = 0; i < 16; i++) {
      const next = this.sweep.next();
      if (next.done) { this.sweep = undefined; break; }
      if (now - next.value[1].updated >= 30 * 60 * 1000) this.buckets.delete(next.value[0]);
    }
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= this.maxEntries) return { seconds: 60, full: true };
      bucket = { tokens: limit.capacity, updated: now };
      this.buckets.set(key, bucket);
    }
    bucket.tokens = Math.min(limit.capacity, bucket.tokens + Math.max(0, now - bucket.updated) / 1000 * limit.perSecond);
    bucket.updated = now;
    if (bucket.tokens < 1) return { seconds: Math.max(1, Math.ceil((1 - bucket.tokens) / limit.perSecond)), full: false };
    bucket.tokens--;
    return null;
  }
}
export const DEFAULT_LIMITS = {
  sessions: { capacity: 60, perSecond: 1 / 30 },
  actions: { capacity: 30, perSecond: 10 },
  reads: { capacity: 60, perSecond: 2 },
  network: { capacity: 600, perSecond: 50 },
} satisfies Record<string, Limit>;
