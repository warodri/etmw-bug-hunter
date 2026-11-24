import { appConfig } from '../config/env';

type Bucket = { hits: number[] };

const MAX_TRACKED_KEYS = 5000;
const PRUNE_EVERY = 200;

/**
 * In-memory limits for the two public auth endpoints. A second server would need a shared store;
 * this app runs as one PM2 fork, so process memory is the authority.
 */
export class AuthRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private operations = 0;

  check(email: string, ip?: string): { allowed: boolean; retryAfterSeconds: number } {
    const windowMs = appConfig.auth.rateWindowMs;
    const emailDecision = this.hit(`email:${email}`, appConfig.auth.rateEmailMax, windowMs);
    const ipDecision = ip
      ? this.hit(`ip:${ip}`, appConfig.auth.rateIpMax, windowMs)
      : { exceeded: false, retryMs: 0 };

    if (emailDecision.exceeded || ipDecision.exceeded) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil(Math.max(emailDecision.retryMs, ipDecision.retryMs) / 1000)
        )
      };
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }

  private hit(key: string, max: number, windowMs: number): { exceeded: boolean; retryMs: number } {
    const now = Date.now();
    const hits = (this.buckets.get(key)?.hits ?? []).filter((stamp) => now - stamp < windowMs);
    const exceeded = hits.length + 1 > max;

    if (!exceeded) {
      hits.push(now);
    }
    this.buckets.set(key, { hits });
    this.prune(now, windowMs);

    if (exceeded) {
      const oldest = hits[0] ?? now;
      return { exceeded: true, retryMs: Math.max(0, windowMs - (now - oldest)) };
    }

    return { exceeded: false, retryMs: 0 };
  }

  private prune(now: number, windowMs: number): void {
    this.operations += 1;
    if (this.operations % PRUNE_EVERY !== 0) return;

    for (const [key, bucket] of this.buckets) {
      if (bucket.hits.every((stamp) => now - stamp >= windowMs)) {
        this.buckets.delete(key);
      }
    }

    if (this.buckets.size > MAX_TRACKED_KEYS) {
      const excess = this.buckets.size - MAX_TRACKED_KEYS;
      let removed = 0;
      for (const key of this.buckets.keys()) {
        this.buckets.delete(key);
        removed += 1;
        if (removed >= excess) break;
      }
    }
  }
}
