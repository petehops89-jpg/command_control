'use strict';

/**
 * rate-limiter.js
 *
 * Token-bucket rate limiter, applied AFTER cheap validation and
 * signature verification (per the assessment, point 4) — never used
 * as a substitute for authentication, and never the reason traffic
 * gets held open before it's proven legitimate.
 *
 * In-memory reference implementation; swap for Redis (INCR + TTL, or
 * a Lua token-bucket script) for multi-instance deployments.
 */

class RateLimiter {
  constructor({ capacity = 20, refillPerSecond = 5 } = {}) {
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this._buckets = new Map(); // key -> { tokens, lastRefillMs }
  }

  /**
   * @param {string} key - typically the sender identity
   * @returns {boolean} true if the request is allowed
   */
  allow(key) {
    const now = Date.now();
    let bucket = this._buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefillMs: now };
      this._buckets.set(key, bucket);
    }

    const elapsedSeconds = (now - bucket.lastRefillMs) / 1000;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsedSeconds * this.refillPerSecond);
    bucket.lastRefillMs = now;

    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }
}

module.exports = { RateLimiter };
