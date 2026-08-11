'use strict';

/**
 * nonce-cache.js
 *
 * First-class replay protection, per the assessment (point 6): every
 * consumed nonce is recorded and rejected on reuse, and entries expire
 * so the cache doesn't grow forever.
 *
 * This is an in-memory reference implementation — fine for a single
 * process / dev / low volume. For multiple Gate Manager instances
 * (horizontal scaling), swap this for a shared store (Redis SETNX
 * with TTL is the standard pattern) behind the same interface:
 * `consume(nonce, expiresAtMs) -> boolean`.
 */

class NonceCache {
  constructor({ cleanupIntervalMs = 30_000 } = {}) {
    this._seen = new Map(); // nonce -> expiresAtMs
    this._timer = setInterval(() => this._cleanup(), cleanupIntervalMs);
    this._timer.unref?.(); // don't keep the process alive just for cleanup
  }

  /**
   * Atomically check-and-mark a nonce as consumed.
   * @returns {boolean} true if this nonce was fresh (accept), false if
   *   it was already seen (reject as replay).
   */
  consume(nonce, expiresAtMs) {
    if (this._seen.has(nonce)) return false;
    this._seen.set(nonce, expiresAtMs);
    return true;
  }

  _cleanup() {
    const now = Date.now();
    for (const [nonce, expiresAtMs] of this._seen) {
      if (expiresAtMs <= now) this._seen.delete(nonce);
    }
  }

  size() {
    return this._seen.size;
  }

  stop() {
    clearInterval(this._timer);
  }
}

module.exports = { NonceCache };
