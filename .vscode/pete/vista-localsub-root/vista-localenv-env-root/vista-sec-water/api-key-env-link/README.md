# Vistamations API Key → Environmental Vault Bridge

## Problem

API keys are scattered:
- Some in `.env` (which was committed to git — bad)
- Some in `kilo.jsonc` (routed through Kilo Gateway — good, but Kilo only)
- Some in process environment (lost on reboot — OpenClaw daemon gets 401)
- Some in Cloudflare `wrangler secret put` (worker only)

No single source of truth. No audit. No rotation.

## What this folder does

`vault.js` provides ONE function that every piece of Vistamations code calls:

```js
const { getSecret } = require('./api-key-env-link/vault');
const deepseekKey = await getSecret('DEEPSEEK_API_KEY');
```

It resolves the secret from the best available source:

| Priority | Source | Use case |
|----------|--------|----------|
| 1 | `globalThis.env` (Cloudflare Worker binding) | Production Workers |
| 2 | `process.env` (Docker inject) | Docker containers |
| 3 | `/run/secrets/` (Docker Swarm) | Docker Swarm |
| 4 | **Windows Credential Manager** (`Get-StoredCredential`) | Your local machine — persists across reboots |
| 5 | `.dev.vars` (wrangler local dev) | Local Cloudflare dev |
| 6 | Encrypted local vault (`%LOCALAPPDATA%\Vistamations\vault\`) | Fallback for any platform |
| 7 | Default values (non-sensitive, known defaults) | Dev convenience |

## Setup (one time per machine)

### Windows — store keys in Credential Manager

```powershell
# From the vista-sec-water directory:
node -e "const v = require('./api-key-env-link/vault'); v.storeSecret('DEEPSEEK_API_KEY', 'sk-your-deepseek-key');"
node -e "const v = require('./api-key-env-link/vault'); v.storeSecret('GEMINI_API_KEY', 'your-gemini-key');"
node -e "const v = require('./api-key-env-link/vault'); v.storeSecret('CLOUDFLARE_API_TOKEN', 'your-cf-token');"
```

This installs `CredentialManager` PowerShell module once, then stores each key in Windows Credential Manager as:
- `Vistamations:DeepSeek`
- `Vistamations:Gemini`
- `Vistamations:Cloudflare`

They survive reboots. The OpenClaw daemon can call `getSecret()` at startup instead of relying on session environment variables.

### Cloudflare Workers — store via wrangler

```bash
npx wrangler secret put GOOGLE_API_KEY
npx wrangler secret put DEEPSEEK_API_KEY
```

The worker code uses the same `getSecret()` call — it detects the Cloudflare environment and reads from `env.GOOGLE_API_KEY` automatically.

### Docker — inject at container start

```yaml
# docker-compose.yml
services:
  app:
    environment:
      - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
```

Where `${DEEPSEEK_API_KEY}` comes from a `.env` file that is **in `.gitignore`** — never committed.

## Audit

```bash
node vault.js
```

Prints every registered secret, whether it's resolved, and its masked value.

## Integration with Gate Manager

The Gate Manager needs a `resolveSenderPublicKey` function. Instead of hardcoding keys, use the vault:

```js
const { getSecret } = require('./api-key-env-link/vault');

const gate = new GateManager({
  resolveSenderPublicKey: async (senderId) => {
    const keysJson = await getSecret('SENDER_PUBLIC_KEYS');
    const keys = JSON.parse(keysJson);
    return keys[senderId] || null;
  },
  capabilitySigningKeyPem: await getSecret('GATE_SIGNING_KEY'),
  // ... rest of config
});
```

## Integration with server.js

In `server.js`, replace all `process.env.SOME_KEY` with:

```js
const { getSecret } = require('./api-key-env-link/vault');

const geminiKey = await getSecret('GEMINI_API_KEY');
const deepseekKey = await getSecret('DEEPSEEK_API_KEY');
```

## Rotation

Each secret in `SECRET_REGISTRY` has a `rotation` field (e.g. "90 days"). The audit command flags any overdue rotations.

To rotate a key:
1. Generate new key from provider
2. `node -e "require('./vault').storeSecret('DEEPSEEK_API_KEY', 'new-key')"` — overwrites credential
3. Restart affected services

## Local encrypted vault (non-Windows)

On Mac/Linux without Credential Manager, secrets are stored encrypted at:
`$HOME/Vistamations/vault/DEEPSEEK_API_KEY.enc`

The encryption key is derived from `hostname + username + machine-id` — so the vault file is only decryptable on the machine that created it.
