'use strict';

/**
 * capability.js
 *
 * Per the assessment (point 12), this is the biggest structural
 * change from the original design: downstream workers never see or
 * trust the client's original request. They only ever see a
 * short-lived, narrowly scoped capability issued by the Gate Manager
 * after full verification.
 *
 * A capability is itself a signed envelope, but signed by the Gate's
 * own capability-issuing key (not the client's key), so a worker only
 * needs one trusted public key to check, regardless of how many
 * clients exist upstream.
 */

const crypto = require('crypto');
const { canonicalize } = require('./envelope');

/**
 * @param {string} issuerPrivateKeyPem - Gate Manager's own Ed25519 key
 * @param {object} verifiedRequest - the envelope that already passed
 *   signature/expiry/replay/rate-limit/authorization checks
 * @param {string[]} permissions - explicit scoped grants, e.g. ['handymail:deliver']
 * @param {number} ttlSeconds - capability lifetime, should be short (seconds, not hours)
 */
function issueCapability(issuerPrivateKeyPem, verifiedRequest, permissions, ttlSeconds = 30) {
  const now = Date.now();
  const capability = {
    request_id: verifiedRequest.request_id,
    sender: verifiedRequest.sender,
    receiver: verifiedRequest.receiver,
    operation: verifiedRequest.operation,
    payload_hash: verifiedRequest.payload_hash,
    permissions,
    issued_at: now,
    expires_at: now + ttlSeconds * 1000,
    capability_id: crypto.randomUUID(),
  };

  const message = Buffer.from(canonicalize(capability), 'utf8');
  const signature = crypto.sign(null, message, issuerPrivateKeyPem).toString('base64');

  return { capability, signature };
}

/**
 * A downstream worker calls this with ONLY the Gate's public key. It
 * never needs to know about client keys, passwords, or the original
 * request at all.
 */
function verifyCapability(issuerPublicKeyPem, capability, signature) {
  try {
    const message = Buffer.from(canonicalize(capability), 'utf8');
    const sigValid = crypto.verify(null, message, issuerPublicKeyPem, Buffer.from(signature, 'base64'));
    if (!sigValid) return { valid: false, reason: 'BAD_SIGNATURE' };
    if (Date.now() > capability.expires_at) return { valid: false, reason: 'EXPIRED' };
    return { valid: true };
  } catch {
    return { valid: false, reason: 'MALFORMED' };
  }
}

function hasPermission(capability, permission) {
  return Array.isArray(capability.permissions) && capability.permissions.includes(permission);
}

module.exports = { issueCapability, verifyCapability, hasPermission };
