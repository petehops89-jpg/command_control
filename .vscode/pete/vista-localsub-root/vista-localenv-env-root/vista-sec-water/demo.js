'use strict';

/**
 * demo.js
 *
 * Runs the full redesigned flow once, end to end, so you can see the
 * pipeline and the audit trail it produces. Nothing here talks to a
 * real network, browser, or database — swap the in-memory pieces
 * (NonceCache, RateLimiter, resolveSenderPublicKey, authorize) for
 * real infrastructure without touching gate-manager.js itself.
 *
 * Run: node demo.js
 */

const { generateKeyPair, signEnvelope, hashPayload } = require('./src/envelope');
const { NonceCache } = require('./src/nonce-cache');
const { RateLimiter } = require('./src/rate-limiter');
const { GateManager } = require('./src/gate-manager');
const { verifyCapability, hasPermission } = require('./src/capability');
const { hashPassword, verifyPassword } = require('./src/password');
const { AuditLog } = require('./src/audit-log');

function main() {
  const audit = new AuditLog();

  // --- Key setup -----------------------------------------------------
  // In production these come from Cloud KMS / Confidential Space, not
  // from generateKeyPairSync in application code.
  const clientKeys = generateKeyPair();     // one per sender identity
  const gateKeys = generateKeyPair();       // Gate's own capability-issuing key

  const senderId = 'stefi@vistamations.com';
  const receiverId = 'info@vistamations.com';

  // --- Password handling (separate from the request envelope) --------
  const loginPassword = 'correct horse battery staple';
  const storedHash = hashPassword(loginPassword);
  console.log('Password stored as:', storedHash.slice(0, 40) + '...');
  console.log('Password verifies:', verifyPassword(loginPassword, storedHash));
  console.log('Wrong password rejected:', verifyPassword('wrong guess', storedHash));
  console.log();

  // --- Gate Manager setup ---------------------------------------------
  const nonceCache = new NonceCache();
  const rateLimiter = new RateLimiter({ capacity: 5, refillPerSecond: 1 });

  const knownSenders = new Map([[senderId, clientKeys.publicKey]]);
  const allowedReceivers = new Set([receiverId]);

  const gate = new GateManager({
    resolveSenderPublicKey: (sender) => knownSenders.get(sender) ?? null,
    nonceCache,
    rateLimiter,
    allowedReceivers,
    capabilitySigningKeyPem: gateKeys.privateKey,
    capabilityTtlSeconds: 30,
    // Authorization policy hook — this is where identity/authority/
    // transaction checks (assessment point 11) would combine, e.g.
    // requiring 2-of-3 independent credentials before allowed=true.
    authorize: async (envelope) => {
      audit.record('AuthorizationEngine', 'evaluate', { request_id: envelope.request_id });
      if (envelope.operation === 'handymail:deliver') {
        return { allowed: true, permissions: ['handymail:deliver'] };
      }
      return { allowed: false, reason: 'OPERATION_NOT_PERMITTED' };
    },
  });

  // --- Client builds and signs a request ------------------------------
  const payload = Buffer.from(JSON.stringify({ document: 'legal-form-001.pdf' }));
  const { envelope, signature } = signEnvelope(clientKeys.privateKey, {
    sender: senderId,
    receiver: receiverId,
    operation: 'handymail:deliver',
    payload_hash: hashPayload(payload),
    ttlSeconds: 60,
  });
  audit.record('Client', 'request_signed', { request_id: envelope.request_id });

  // --- Run it through the gate -----------------------------------------
  run(gate, envelope, signature, gateKeys, audit).then(() => {
    console.log('\n--- Audit trail ---');
    for (const entry of audit.all()) {
      console.log(`[${entry.ts}] ${entry.component}: ${entry.event}`, entry);
    }
  });
}

async function run(gate, envelope, signature, gateKeys, audit) {
  console.log('--- First submission (expected: accepted) ---');
  const result = await gate.processRequest(envelope, signature);
  console.log(result.ok ? 'ACCEPTED' : `REJECTED: ${result.reason}`);

  if (result.ok) {
    audit.record('GateManager', 'capability_issued', { capability_id: result.capability.capability_id });

    // --- Downstream worker only ever sees the capability, never the
    //     original client envelope/signature/key.
    const check = verifyCapability(gateKeys.publicKey, result.capability, result.signature);
    console.log('Worker-side capability check:', check);
    console.log(
      'Worker permission check (handymail:deliver):',
      hasPermission(result.capability, 'handymail:deliver'),
    );
    audit.record('Worker', 'capability_verified', { valid: check.valid });
  }

  console.log('\n--- Replay of the exact same envelope (expected: rejected) ---');
  const replay = await gate.processRequest(envelope, signature);
  console.log(replay.ok ? 'ACCEPTED (BUG!)' : `REJECTED: ${replay.reason}`);
  audit.record('GateManager', 'replay_attempt', { accepted: replay.ok });
}

main();
