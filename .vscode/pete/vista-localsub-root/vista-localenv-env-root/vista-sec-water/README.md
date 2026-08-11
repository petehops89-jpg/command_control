# Vistamations Gate Manager (redesigned)

This replaces the crypto/authentication layer of the original Handy
Mail design with standard primitives, per the security assessment.
It keeps the parts of the original concept that were architecturally
sound (a hardened gate between clients and execution) and rebuilds
everything underneath it.

## What changed from the original design

| Original | Replaced with | Why |
|---|---|---|
| Signature split into 3 encrypted fragments | Single Ed25519 signature over a canonical envelope | Fragments of one secret ≠ independent credentials — anyone with all 3 pieces has the whole thing |
| `sha256(password)` | `scrypt` (salted, deliberately slow) | Plain SHA-256 is fast to brute-force offline |
| Public-key encryption used to "prove" origin | Ed25519 **signatures** for authenticity, encryption kept separate for confidentiality | Encryption proves who can *read* something, not who *sent* it |
| 10-second delay before validation | Cheap validation → signature → expiry → replay → rate limit, in that order, *before* anything expensive | A deliberate pre-auth delay is a DoS amplifier, not a control |
| `^[A-Z0-9]{2}-[A-Z0-9]{2}-[A-Z0-9]{2}$` cluster key | Nonce + timestamp + signature bound to the whole request | Regex-shape checks don't authenticate anything |
| No replay protection | `NonceCache` — every nonce consumed exactly once | Captured packets were replayable indefinitely |
| Worker trusts the raw client request | Worker only ever sees a short-lived, scoped **capability** signed by the Gate | Downstream code shouldn't have to re-derive trust in the original client |
| Playwright with `--disable-web-security` / `--no-sandbox` to beat CORS/CAPTCHA | **Not included.** Use real server-to-server API calls; if a target requires browser interaction, use its supported integration | CORS is not a server-to-server problem, and defeating CAPTCHA isn't something to build a security architecture around |

## Trust model

| Component | Trust level |
|---|---|
| Client | Untrusted |
| Network | Untrusted |
| Gate Manager | Trusted |
| Authorization engine | Highly trusted |
| Job queue | Semi-trusted |
| Downstream worker | Untrusted / sandboxed — only ever sees a capability, never the client's raw request |
| Audit log | Trusted, append-only |

## Data flow

```
CLIENT
  │ signs envelope { request_id, sender, receiver, operation,
  │                  payload_hash, nonce, issued_at, expires_at }
  ▼
GATE MANAGER  (gate-manager.js)
  1. shape validation        (cheap — reject garbage first)
  2. signature verification  (proves sender identity)
  3. expiry check
  4. replay check             (nonce-cache.js)
  5. receiver binding         (must be an allowed, known receiver)
  6. rate limiting            (rate-limiter.js — authenticated senders only)
  7. authorization policy     (your business logic — identity / authority / transaction)
  ▼
CAPABILITY ISSUER  (capability.js)
  short-lived, narrowly scoped token signed by the Gate's own key
  ▼
JOB QUEUE / WORKER
  verifies the capability against ONE public key (the Gate's) —
  never needs to know about client keys or passwords at all
  ▼
TARGET (Cloud Storage bucket, external API, etc.)
```

Independently, every component writes to the same append-only
`AuditLog`.

## Files

- `src/envelope.js` — Ed25519 keygen, canonical signing/verification, payload hashing
- `src/nonce-cache.js` — replay protection (swap for Redis in multi-instance deployments)
- `src/rate-limiter.js` — token-bucket limiter, applied post-authentication only
- `src/password.js` — scrypt-based password hashing (see note below re: Argon2id)
- `src/capability.js` — short-lived scoped capability issuance/verification
- `src/gate-manager.js` — the ordered validation pipeline itself
- `src/audit-log.js` — minimal append-only audit trail (swap for Cloud Logging in production)
- `demo.js` — runs the full flow once, including a replay attempt that gets rejected

Run it:

```bash
npm run demo
```

## Production notes (things this reference implementation does not do)

- **Key storage.** `generateKeyPairSync` in application code is for the
  demo only. In production, signing keys belong in Cloud KMS or a
  Confidential Space enclave — the Gate Manager should call out to
  sign/verify, never hold raw private key material in process memory
  longer than necessary.
- **Argon2id.** `password.js` uses `scrypt` (built into Node, no native
  compile step) rather than Argon2id, to keep this dependency-free.
  If you specifically want Argon2id, swap the internals of
  `hashPassword`/`verifyPassword` for the `argon2` npm package — the
  interface other modules call stays identical.
- **Nonce cache / rate limiter persistence.** Both are in-memory and
  reset on restart, and don't share state across multiple Gate
  Manager instances. For real horizontal scaling, back both with
  Redis (`SETNX` + TTL for nonces, a Lua token-bucket script or
  `INCR` + TTL for rate limits).
- **Transport security.** All of this assumes requests already arrive
  over TLS. None of the envelope signing replaces TLS — it protects
  against a different threat (forged/replayed application-layer
  requests), not network eavesdropping.
- **The bitmap/watermark/QR layer.** Per the assessment, treat these
  as a tamper-evident UI/protocol carrier, not as authentication.
  They can sit on top of this Gate Manager (e.g. the QR code encodes
  a `request_id` that the scanning app submits to the Gate) but
  should never be relied on as the security boundary itself.
