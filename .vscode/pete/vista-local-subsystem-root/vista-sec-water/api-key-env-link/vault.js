'use strict';

/**
 * vault.js — Vistamations Unified Secrets Bridge
 *
 * Part of vista-sec-water. The Gate Manager needs keys to verify
 * signatures and authorize senders. This module answers one question:
 * "Where does every API key, signing key, and secret actually live?"
 *
 * The answer depends on WHERE the code is running:
 *
 *   Local Windows   → Windows Credential Manager (persists across reboots)
 *   Docker container → process.env injected at container start (never in .env file)
 *   Cloudflare Worker → wrangler secret put → env binding
 *   Node.js server   → process.env (with fallback chain)
 *
 * USAGE (any module in the project):
 *   const { getSecret } = require('./api-key-env-link/vault');
 *   const deepseekKey = await getSecret('DEEPSEEK_API_KEY');
 *   const geminiKey  = await getSecret('GEMINI_API_KEY');
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── REGISTERED SECRETS — Master inventory of every key in the system ───

const SECRET_REGISTRY = {
  // ── AI Provider Keys ──
  DEEPSEEK_API_KEY: {
    description: 'DeepSeek V4 Pro API key (primary model)',
    credentialTarget: 'Vistamations:DeepSeek',
    required: true,
    rotation: '90 days',
  },
  GEMINI_API_KEY: {
    description: 'Google Gemini / Vertex AI API key',
    credentialTarget: 'Vistamations:Gemini',
    required: true,
    rotation: '90 days',
    cloudflareSecret: 'GOOGLE_API_KEY',
  },
  MISTRAL_API_KEY: {
    description: 'Mistral Large 3 API key (Olivia model)',
    credentialTarget: 'Vistamations:Mistral',
    required: false,
    fallback: 'DEEPSEEK_API_KEY',
  },

  // ── Cloudflare Keys ──
  CLOUDFLARE_API_TOKEN: {
    description: 'Cloudflare API token (D1, Workers, Pages, R2)',
    credentialTarget: 'Vistamations:Cloudflare',
    required: true,
  },
  CLOUDFLARE_ACCOUNT_ID: {
    description: 'Cloudflare Account ID (a3cfe4297f6a3fedf411ba7e7d6f2751)',
    required: false,
    defaultValue: 'a3cfe4297f6a3fedf411ba7e7d6f2751',
  },

  // ── Infrastructure Keys ──
  OLIVIA_API_URL: {
    description: 'Olivia command portal endpoint for agent reporting',
    required: false,
    defaultValue: 'http://localhost/api/olivia',
  },
  D1_WORKER_URL: {
    description: 'Cloudflare D1 Worker base URL',
    required: false,
    defaultValue: 'https://vistamations-agent-memory.hops1010.workers.dev',
  },

  // ── Gate Manager Signing Keys ──
  GATE_SIGNING_KEY: {
    description: 'Ed25519 private key for Gate Manager capability signing',
    credentialTarget: 'Vistamations:GateSigningKey',
    required: true,
    rotation: '30 days',
    _neverLog: true,
  },
  SENDER_PUBLIC_KEYS: {
    description: 'JSON map of sender_id → Ed25519 public key PEM',
    required: false,
    defaultValue: '{}',
  },
};

// ─── RESOLUTION CHAIN: Try each source in order until one returns a value ───

/**
 * @param {string} name — key name from SECRET_REGISTRY
 * @returns {Promise<string|null>}
 */
async function getSecret(name) {
  const entry = SECRET_REGISTRY[name];
  if (!entry) return null; // unknown secret — caller decides if that's fatal

  // 1. Cloudflare Worker: check env binding (highest priority)
  if (typeof globalThis !== 'undefined' && typeof globalThis.env !== 'undefined') {
    const cfSecretName = entry.cloudflareSecret || name;
    const val = globalThis.env[cfSecretName];
    if (val) return val;
  }

  // 2. Process environment (Docker / Node.js server)
  //    These are injected at container start, never committed to git.
  const envVal = process.env[name];
  if (envVal) return envVal;

  // 3. Docker secret file (Docker Swarm / Compose secrets mount)
  try {
    const secretFile = `/run/secrets/${name.toLowerCase()}`;
    if (fs.existsSync(secretFile)) {
      return fs.readFileSync(secretFile, 'utf8').trim();
    }
  } catch (_) { /* not in Docker */ }

  // 4. Windows Credential Manager (persists across reboots — fixes the
  //    401-after-restart problem where OpenClaw daemon loses env vars)
  if (process.platform === 'win32' && entry.credentialTarget) {
    try {
      const pwsh = `Get-StoredCredential -Target "${entry.credentialTarget}" -AsCredentialObject -ErrorAction Stop | Select-Object -ExpandProperty Password | ForEach-Object { $_.ReadAsString() }`;
      const result = execSync(
        `powershell -NoProfile -Command "${pwsh}"`,
        { encoding: 'utf8', timeout: 5000, windowsHide: true }
      ).trim();
      if (result && !result.includes('Cannot find')) return result;
    } catch (_) { /* Credential Manager not available or target not stored */ }
  }

  // 5. Cloudflare Wrangler (for local dev with wrangler secret bulk)
  try {
    const devVarPath = path.join(process.cwd(), '.dev.vars');
    if (fs.existsSync(devVarPath)) {
      const lines = fs.readFileSync(devVarPath, 'utf8').split('\n');
      for (const line of lines) {
        const [key, ...rest] = line.split('=');
        if (key.trim() === name) return rest.join('=').trim();
      }
    }
  } catch (_) { /* no .dev.vars file */ }

  // 6. Encrypted local fallback store (for secrets that don't fit in
  //    Credential Manager — encrypted with a machine-specific key)
  const vaultDir = path.join(process.env.LOCALAPPDATA || process.env.HOME || '.', 'Vistamations', 'vault');
  const vaultFile = path.join(vaultDir, `${name}.enc`);
  if (fs.existsSync(vaultFile)) {
    try {
      return decryptLocal(vaultFile);
    } catch (_) { /* decryption failed — wrong machine or corrupted */ }
  }

  // 7. Hardcoded default (non-sensitive, known values)
  if (entry.defaultValue) return entry.defaultValue;

  // 8. Registered fallback chain
  if (entry.fallback) return getSecret(entry.fallback);

  return null;
}

// ─── Optional: store a secret into Windows Credential Manager ───

/**
 * Store a secret in Windows Credential Manager. Run once per key, per machine.
 * Usage: node -e "require('./vault').storeSecret('DEEPSEEK_API_KEY', 'sk-...')"
 */
function storeSecret(name, value) {
  const entry = SECRET_REGISTRY[name];
  if (!entry) throw new Error(`Unknown secret: ${name}`);

  if (process.platform === 'win32' && entry.credentialTarget) {
    const pwsh = `$pw = ConvertTo-SecureString "${value}" -AsPlainText -Force; $cred = New-Object System.Management.Automation.PSCredential("${entry.credentialTarget}", $pw); Install-Module -Name CredentialManager -Force -Scope CurrentUser -ErrorAction SilentlyContinue; New-StoredCredential -Target "${entry.credentialTarget}" -Credentials $cred -Type Generic -Persist LocalMachine -ErrorAction Stop`;
    execSync(`powershell -NoProfile -Command "${pwsh}"`, { encoding: 'utf8', timeout: 10000, windowsHide: true });
    return true;
  }

  // Non-Windows: store encrypted locally
  const vaultDir = path.join(process.env.HOME || '.', 'Vistamations', 'vault');
  fs.mkdirSync(vaultDir, { recursive: true });
  const vaultFile = path.join(vaultDir, `${name}.enc`);
  encryptLocal(vaultFile, value);
  return true;
}

// ─── Audit: list all registered secrets and their resolution status ───

async function auditSecrets() {
  const results = [];
  for (const [name, entry] of Object.entries(SECRET_REGISTRY)) {
    const resolved = await getSecret(name);
    results.push({
      name,
      description: entry.description,
      required: entry.required,
      resolved: !!resolved,
      source: resolved ? 'resolved' : 'MISSING',
      masked: resolved && entry._neverLog ? '***' : (resolved ? resolved.substring(0, 8) + '...' : null),
    });
  }
  return results;
}

// ─── Local encrypted store (machine-specific — NOT portable) ───

function encryptLocal(filePath, plaintext) {
  const key = getMachineKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv (16) + authTag (16) + ciphertext
  const bundle = Buffer.concat([iv, authTag, encrypted]);
  fs.writeFileSync(filePath, bundle.toString('base64'));
}

function decryptLocal(filePath) {
  const key = getMachineKey();
  const bundle = Buffer.from(fs.readFileSync(filePath, 'utf8'), 'base64');
  const iv = bundle.subarray(0, 16);
  const authTag = bundle.subarray(16, 32);
  const encrypted = bundle.subarray(32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/**
 * Derive a machine-specific key from:
 *   hostname + username + machine SID (Windows) / machine-id (Linux)
 * This means secrets encrypted on THIS machine can ONLY be decrypted
 * on THIS machine — no portable vault file to steal.
 */
function getMachineKey() {
  const hostname = require('os').hostname();
  const username = require('os').userInfo().username;
  let machineId = hostname;
  try {
    if (process.platform === 'win32') {
      machineId = execSync('powershell -NoProfile -Command "(Get-WmiObject Win32_UserAccount | Where-Object { $_.Name -eq $env:USERNAME }).SID"', { encoding: 'utf8', timeout: 3000, windowsHide: true }).trim();
    } else {
      machineId = fs.readFileSync('/etc/machine-id', 'utf8').trim();
    }
  } catch (_) { /* fallback to hostname */ }
  return crypto.createHash('sha256').update(`${hostname}:${username}:${machineId}`).digest();
}

// ─── Cloudflare Worker shim (tree-shaken out in non-worker builds) ───

function cloudflareGetSecret(name, env) {
  if (!env) return null;
  const entry = SECRET_REGISTRY[name];
  if (!entry) return null;
  const cfName = entry.cloudflareSecret || name;
  return env[cfName] || null;
}

module.exports = {
  getSecret,
  storeSecret,
  auditSecrets,
  cloudflareGetSecret,
  SECRET_REGISTRY,
};

// ─── Self-test (run: node vault.js) ───
if (require.main === module) {
  (async () => {
    console.log('=== Vistamations Vault Audit ===\n');
    const results = await auditSecrets();
    let ok = 0, missing = 0;
    for (const r of results) {
      const icon = r.resolved ? '✅' : (r.required ? '❌' : '⚠️');
      console.log(`${icon} ${r.name.padEnd(28)} ${r.resolved ? r.masked.padEnd(12) : 'NOT SET'}  ${r.description}`);
      if (r.resolved) ok++; else if (r.required) missing++;
    }
    console.log(`\n${ok} resolved, ${missing} required secrets missing`);
  })();
}
