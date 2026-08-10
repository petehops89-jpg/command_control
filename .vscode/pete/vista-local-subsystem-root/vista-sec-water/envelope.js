'use strict';

/**
 * envelope.js
 *
 * Ed25519 signing/verification for request envelopes.
 *
 * Design principle from the assessment: encryption and signing solve
 * different problems and must not be conflated.
 *   - Encryption: "only the holder of the private key can read this"
 *   - Signature:  "the holder of the signing key created/approved this"
 *
 * This module only handles signing/verification of the envelope
 * metadata (who / what / when / nonce / payload hash). Payload
 * confidentiality (if needed) is a separate concern — encrypt the
 * payload with a symmetric key (e.g. AES-256-GCM) and put the
 * resulting ciphertext hash into payload_hash below. Do not encrypt
 * the signature itself, and do not derive the signature from
 * encrypted fragments (that was the original design's core flaw).
 */

const crypto = require('crypto');

/** Generate a new Ed25519 signing keypair (PEM encoded). */
function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

/**
 * Canonical JSON serialization so signer and verifier always hash the
 * exact same bytes regardless of key insertion order.
 */
function canonicalize(obj) {
  const sortedKeys = Object.keys(obj).sort();
  const sorted = {};
  for (const k of sortedKeys) sorted[k] = obj[k];
  return JSON.stringify(sorted);
}

/**
 * Build and sign an envelope.
 *
 * @param {string} privateKeyPem - sender's Ed25519 private key (PEM)
 * @param {object} fields - { sender, receiver, operation, payload_hash, ttlSeconds }
 * @returns {{ envelope: object, signature: string }}
 */
function signEnvelope(privateKeyPem, fields) {
  const now = Date.now();
  const ttlMs = (fields.ttlSeconds ?? 60) * 1000; // short-lived by default

  const envelope = {
    request_id: crypto.randomUUID(),
    nonce: crypto.randomBytes(32).toString('base64'),
    sender: fields.sender,
    receiver: fields.receiver,
    operation: fields.operation,
    payload_hash: fields.payload_hash,
    issued_at: now,
    expires_at: now + ttlMs,
  };

  const message = Buffer.from(canonicalize(envelope), 'utf8');
  const signature = crypto.sign(null, message, privateKeyPem).toString('base64');

  return { envelope, signature };
}

/**
 * Verify an envelope's signature against a claimed sender public key.
 * Does NOT check expiry/replay/authorization — that's the Gate
 * Manager's job, in a specific order, cheapest checks first.
 *
 * @returns {boolean}
 */
function verifyEnvelopeSignature(publicKeyPem, envelope, signature) {
  try {
    const message = Buffer.from(canonicalize(envelope), 'utf8');
    return crypto.verify(null, message, publicKeyPem, Buffer.from(signature, 'base64'));
  } catch {
    // Malformed key/signature/envelope -> treat as invalid, never throw
    // out of the verifier into caller code that might mis-handle it.
    return false;
  }
}

/** Hash a payload buffer/string for inclusion in the envelope. */
function hashPayload(payload) {
  const buf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
  return crypto.createHash('sha256').update(buf).digest('hex');
}

module.exports = {
  generateKeyPair,
  signEnvelope,
  verifyEnvelopeSignature,
  hashPayload,
  canonicalize,
};
