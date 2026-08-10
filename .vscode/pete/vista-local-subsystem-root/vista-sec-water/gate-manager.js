'use strict';

/**
 * gate-manager.js
 *
 * The hardened gate sitting between untrusted clients and the
 * execution environment. Per the assessment (points 4, 10, 13), the
 * pipeline runs cheapest/cheapest-to-forge checks first and never
 * does expensive work (rate-accounted delays, downstream calls,
 * capability issuance) before a request is proven authentic and
 * fresh.
 *
 * Order matters:
 *   1. Shape validation      (cheap, no crypto)
 *   2. Signature verification (cheap-ish, rejects forged senders)
 *   3. Expiry check           (cheap, rejects stale requests)
 *   4. Replay check           (cheap, rejects reused nonces)
 *   5. Receiver binding       (cheap, rejects mis-addressed requests)
 *   6. Rate limiting          (only spend budget on real, fresh requests)
 *   7. Authorization policy   (may be more expensive — DB/policy lookups)
 *   8. Capability issuance    (only for fully authorized requests)
 */

const { verifyEnvelopeSignature } = require('./envelope');
const { issueCapability } = require('./capability');

const REQUIRED_FIELDS = [
  'request_id', 'nonce', 'sender', 'receiver',
  'operation', 'payload_hash', 'issued_at', 'expires_at',
];

class GateManager {
  /**
   * @param {object} opts
   * @param {(sender: string) => string|null} opts.resolveSenderPublicKey
   *   Look up a sender's known Ed25519 public key. Returning null
   *   means "unknown sender" -> reject.
   * @param {NonceCache} opts.nonceCache
   * @param {RateLimiter} opts.rateLimiter
   * @param {Set<string>} opts.allowedReceivers
   * @param {(envelope: object) => Promise<{allowed: boolean, permissions?: string[], reason?: string}>} opts.authorize
   *   Policy hook: given a verified, fresh, rate-limited envelope,
   *   decide if the operation is permitted and what it's scoped to.
   * @param {string} opts.capabilitySigningKeyPem - Gate's own private key
   */
  constructor({
    resolveSenderPublicKey,
    nonceCache,
    rateLimiter,
    allowedReceivers,
    authorize,
    capabilitySigningKeyPem,
    capabilityTtlSeconds = 30,
  }) {
    this.resolveSenderPublicKey = resolveSenderPublicKey;
    this.nonceCache = nonceCache;
    this.rateLimiter = rateLimiter;
    this.allowedReceivers = allowedReceivers;
    this.authorize = authorize;
    this.capabilitySigningKeyPem = capabilitySigningKeyPem;
    this.capabilityTtlSeconds = capabilityTtlSeconds;
  }

  /**
   * @returns {Promise<{ ok: true, capability, signature } | { ok: false, reason: string }>}
   */
  async processRequest(envelope, signature) {
    // 1. Shape validation — no crypto, no lookups, reject garbage instantly.
    const shapeError = this._validateShape(envelope, signature);
    if (shapeError) return { ok: false, reason: shapeError };

    // 2. Signature verification — proves the sender identity claim.
    const senderPublicKey = this.resolveSenderPublicKey(envelope.sender);
    if (!senderPublicKey) return { ok: false, reason: 'UNKNOWN_SENDER' };

    const sigValid = verifyEnvelopeSignature(senderPublicKey, envelope, signature);
    if (!sigValid) return { ok: false, reason: 'INVALID_SIGNATURE' };

    // 3. Expiry — reject stale requests before touching the nonce cache.
    const now = Date.now();
    if (now > envelope.expires_at) return { ok: false, reason: 'EXPIRED' };
    if (envelope.issued_at > now + 5_000) return { ok: false, reason: 'ISSUED_IN_FUTURE' };

    // 4. Replay protection — only proven-authentic, fresh requests
    //    consume a nonce slot.
    const fresh = this.nonceCache.consume(envelope.nonce, envelope.expires_at);
    if (!fresh) return { ok: false, reason: 'REPLAY_DETECTED' };

    // 5. Receiver binding — the request must be addressed to a real,
    //    allowed receiver, not just structurally valid (assessment, point 5).
    if (!this.allowedReceivers.has(envelope.receiver)) {
      return { ok: false, reason: 'UNKNOWN_RECEIVER' };
    }

    // 6. Rate limiting — applied to authenticated senders only, never
    //    used as a stand-in for authentication itself.
    if (!this.rateLimiter.allow(envelope.sender)) {
      return { ok: false, reason: 'RATE_LIMITED' };
    }

    // 7. Authorization policy — may hit a DB/policy engine. Only
    //    reached for requests that already passed every cheap check.
    const decision = await this.authorize(envelope);
    if (!decision.allowed) {
      return { ok: false, reason: decision.reason ?? 'NOT_AUTHORIZED' };
    }

    // 8. Capability issuance — the ONLY thing downstream workers ever
    //    see. They never see the raw client envelope or signature.
    const { capability, signature: capSignature } = issueCapability(
      this.capabilitySigningKeyPem,
      envelope,
      decision.permissions ?? [],
      this.capabilityTtlSeconds,
    );

    return { ok: true, capability, signature: capSignature };
  }

  _validateShape(envelope, signature) {
    if (!envelope || typeof envelope !== 'object') return 'MALFORMED_ENVELOPE';
    if (typeof signature !== 'string' || signature.length === 0) return 'MALFORMED_SIGNATURE';
    for (const field of REQUIRED_FIELDS) {
      if (!(field in envelope)) return `MISSING_FIELD:${field}`;
    }
    if (typeof envelope.issued_at !== 'number' || typeof envelope.expires_at !== 'number') {
      return 'MALFORMED_TIMESTAMPS';
    }
    if (envelope.expires_at <= envelope.issued_at) return 'INVALID_TTL';
    return null;
  }
}

module.exports = { GateManager };
