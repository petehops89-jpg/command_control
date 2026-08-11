'use strict';

/**
 * gate-vault-bridge.js
 *
 * Bridges the Vault (api-key-env-link/vault.js) into the Gate Manager
 * (gate-manager.js). This is the "resolveSenderPublicKey" implementation
 * that the Gate Manager's constructor expects — pulling real keys from
 * the vault instead of hardcoded test keys.
 *
 * Also provides a pre-configured Gate Manager factory so server.js and
 * agent-daemon.js can spin up the gate without repeating the wiring.
 *
 * Usage in server.js:
 *   const { createGate } = require('./api-key-env-link/gate-vault-bridge');
 *   const gate = await createGate();
 *   const result = await gate.processRequest(envelope, signature);
 */

const { GateManager } = require('../gate-manager');
const { NonceCache } = require('../nonce-cache.js');
const { TokenBucketRateLimiter } = require('../rate-limiter.js');
const { getSecret } = require('./vault');
const crypto = require('crypto');

/**
 * Creates a Gate Manager instance wired to the vault for key resolution.
 * Call this ONCE at server startup — the gate is stateless (nonce cache
 * and rate limiter are the only mutable state).
 *
 * @returns {Promise<GateManager>}
 */
async function createGate() {
  // Resolve sender public keys from the vault
  const keysJson = await getSecret('SENDER_PUBLIC_KEYS');
  let senderKeys = {};
  try { senderKeys = JSON.parse(keysJson || '{}'); } catch (_) { /* empty */ }

  const resolveSenderPublicKey = (senderId) => {
    // First: check known senders from vault
    if (senderKeys[senderId]) return senderKeys[senderId];

    // Fallback: if the senderId itself looks like a PEM key (for testing
    // or local dev), accept it directly. REMOVE THIS IN PRODUCTION.
    if (senderId.startsWith('-----BEGIN PUBLIC KEY-----')) return senderId;

    return null; // unknown sender
  };

  // Get the Gate's own signing key from the vault
  const signingKeyPem = await getSecret('GATE_SIGNING_KEY');
  if (!signingKeyPem) {
    // If no key stored, generate one and warn (dev mode only)
    const { generateKeyPair } = require('../envelope');
    const keys = generateKeyPair();
    console.warn('[gate-vault-bridge] WARNING: No GATE_SIGNING_KEY in vault.');
    console.warn('[gate-vault-bridge] Generated a temporary key. Store it with:');
    console.warn(`[gate-vault-bridge]   node -e "require('./api-key-env-link/vault').storeSecret('GATE_SIGNING_KEY', \`${keys.privateKey.replace(/\n/g, '\\n')}\`)"`);
    return new GateManager({
      resolveSenderPublicKey,
      nonceCache: new NonceCache(),
      rateLimiter: new TokenBucketRateLimiter({ maxTokens: 120, refillRate: 20 }), // Increased for local model
      allowedReceivers: new Set(['olivia', 'command-portal', 'media-player', 'gem', 'openclaw', 'agent-daemon', 'ollama']),
      authorize: defaultAuthorize,
      capabilitySigningKeyPem: keys.privateKey,
      capabilityTtlSeconds: 30,
    });
  }

  return new GateManager({
    resolveSenderPublicKey,
    nonceCache: new NonceCache(),
    rateLimiter: new TokenBucketRateLimiter({ maxTokens: 120, refillRate: 20 }), // Increased for local model
    allowedReceivers: new Set(['olivia', 'command-portal', 'media-player', 'gem', 'openclaw', 'agent-daemon', 'ollama']),
    authorize: defaultAuthorize,
    capabilitySigningKeyPem: signingKeyPem,
    capabilityTtlSeconds: 30,
  });
}

/**
 * Default authorization policy — replace with your real policy.
 * For now: any authenticated sender can perform any operation.
 */
async function defaultAuthorize(envelope) {
  return { allowed: true, permissions: ['read', 'write'] };
}

module.exports = { createGate };
