'use strict';

/**
 * pin-vault.js — PIN-protected unified secrets vault
 *
 * Gate layer around vault.js. Every secret access requires a 4-digit PIN.
 * The PIN is verified against a scrypt hash stored in Windows Credential
 * Manager (Vistamations:VaultPIN). On first run, no PIN exists — you
 * enroll one interactively.
 *
 * ARCHITECTURE:
 *   Pete (human) → 4-digit PIN → pin-vault.js → vault.js → secrets
 *
 *   System (automated) → vault.js → secrets (bypasses PIN for
 *     docker-injected env vars, .dev.vars, and Cloudflare Worker bindings)
 *
 * ENVIRONMENTS:
 *   Local (Windows)   — PIN required for manual store/retrieve; system
 *                        auto-reads process.env for Docker/Node
 *   GCloud             — Secrets in GCloud Secret Manager (env-root)
 *   Cloudflare Workers — wrangler secrets (env-root)
 *
 * USAGE:
 *   const { getSecret, storeSecret, auditSecrets, verifyPin, enrollPin } =
 *     require('./pin-vault');
 *
 *   await verifyPin('1234');          // prompt or programmatic
 *   const key = await getSecret('DEEPSEEK_API_KEY');  // PIN auto-checked
 *   await storeSecret('DEEPSEEK_API_KEY', 'sk-...');   // PIN auto-checked
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PIN_TARGET = 'Vistamations:VaultPIN';
const PIN_LENGTH = 4;
const PIN_MAX_ATTEMPTS = 3;
const PIN_LOCKOUT_MS = 300000; // 5 minutes after 3 failures

// ─── State ───

let _pinVerifiedAt = 0;       // timestamp of last successful PIN verification
let _pinVerified = false;     // whether PIN is currently valid
let _loginTimeout = null;     // auto-lock timer handle
const PIN_AUTO_LOCK_MS = 180000; // auto-lock after 3 minutes of inactivity
let _failedAttempts = 0;
let _lockoutUntil = 0;

// ─── PIN lifecycle ───

/** Returns true if a PIN has been enrolled on this machine. */
function isPinEnrolled() {
  if (process.platform !== 'win32') {
    const pinFile = path.join(require('os').homedir(), 'Vistamations', 'vault', '.pin-hash');
    return fs.existsSync(pinFile);
  }
  try {
    const pwsh = `Get-StoredCredential -Target '${PIN_TARGET}' -ErrorAction Stop`;
    execSync(
      `powershell -NoProfile -Command "${pwsh}"`,
      { encoding: 'utf8', timeout: 5000, windowsHide: true }
    );
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Verify a 4-digit PIN against the stored scrypt hash.
 * Returns { ok: true } or { ok: false, reason: string }.
 */
async function verifyPin(pin) {
  if (Date.now() < _lockoutUntil) {
    const remaining = Math.ceil((_lockoutUntil - Date.now()) / 1000);
    return { ok: false, reason: `Locked out. Try again in ${remaining}s.` };
  }

  const stored = readPinHash();
  if (!stored) {
    return { ok: false, reason: 'No PIN enrolled. Run enrollPin() first.' };
  }

  const match = await verifyScrypt(pin, stored);
  if (match) {
    _pinVerified = true;
    _pinVerifiedAt = Date.now();
    _failedAttempts = 0;
    _lockoutUntil = 0;
    resetAutoLock();
    return { ok: true };
  }

  _failedAttempts++;
  if (_failedAttempts >= PIN_MAX_ATTEMPTS) {
    _lockoutUntil = Date.now() + PIN_LOCKOUT_MS;
    _failedAttempts = 0;
    return { ok: false, reason: 'Too many failed attempts. Locked out for 5 minutes.' };
  }
  return { ok: false, reason: `Wrong PIN. ${PIN_MAX_ATTEMPTS - _failedAttempts} attempt(s) remaining.` };
}

/**
 * Called after every successful PIN operation to keep the session alive.
 */
function resetAutoLock() {
  if (_loginTimeout) clearTimeout(_loginTimeout);
  _loginTimeout = setTimeout(() => {
    _pinVerified = false;
    _pinVerifiedAt = 0;
    _loginTimeout = null;
  }, PIN_AUTO_LOCK_MS).unref();
}

/** Manually lock the vault. */
function lockVault() {
  _pinVerified = false;
  _pinVerifiedAt = 0;
  if (_loginTimeout) { clearTimeout(_loginTimeout); _loginTimeout = null; }
}

/** Get PIN session state. */
function pinState() {
  return {
    enrolled: isPinEnrolled(),
    verified: _pinVerified,
    verifiedAt: _pinVerifiedAt ? new Date(_pinVerifiedAt).toISOString() : null,
    autoLockMs: PIN_AUTO_LOCK_MS,
    lockoutUntil: _lockoutUntil ? new Date(_lockoutUntil).toISOString() : null,
    failedAttempts: _failedAttempts,
  };
}

// ─── Enrollment ───

/**
 * Enroll a new 4-digit PIN. Overwrites any existing PIN.
 * Stores a scrypt hash, never the PIN itself.
 */
async function enrollPin(pin) {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('PIN must be exactly 4 digits (0000-9999)');
  }

  const hash = await hashScrypt(pin);

  if (process.platform === 'win32') {
    const hashB64 = Buffer.from(hash, 'utf8').toString('base64');
    const pscmd = [
      `$b64 = '${hashB64}'`,
      `$hash = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b64))`,
      `$pw = ConvertTo-SecureString $hash -AsPlainText -Force`,
      `$cred = New-Object System.Management.Automation.PSCredential('${PIN_TARGET}', $pw)`,
      `New-StoredCredential -Target '${PIN_TARGET}' -Credentials $cred -Type Generic -Persist LocalMachine -ErrorAction Stop`,
    ].join('; ');
    execSync(`powershell -NoProfile -Command "${pscmd}"`, { encoding: 'utf8', timeout: 15000, windowsHide: true });
  } else {
    const vaultDir = path.join(require('os').homedir(), 'Vistamations', 'vault');
    fs.mkdirSync(vaultDir, { recursive: true });
    fs.writeFileSync(path.join(vaultDir, '.pin-hash'), hash);
  }

  _pinVerified = true;
  _pinVerifiedAt = Date.now();
  _failedAttempts = 0;
  _lockoutUntil = 0;
  resetAutoLock();

  return { ok: true, message: 'PIN enrolled.' };
}

/** Change PIN (requires old PIN). */
async function changePin(oldPin, newPin) {
  const result = await verifyPin(oldPin);
  if (!result.ok) return result;
  await enrollPin(newPin);
  return { ok: true, message: 'PIN changed.' };
}

// ─── Vault operations (PIN-gated) ───

// We lazy-load the base vault to avoid circular dependency and keep
// pin-vault.js the single entry point for all secret operations.

const VAULT_PATH = path.join(__dirname, 'vault.js');
let _vault = null;
function vault() {
  if (!_vault) _vault = require(VAULT_PATH);
  return _vault;
}

async function getSecret(name) {
  await requirePin('read secrets');
  return vault().getSecret(name);
}

async function storeSecret(name, value) {
  await requirePin('store secrets');
  resetAutoLock();
  return vault().storeSecret(name, value);
}

async function auditSecrets() {
  await requirePin('audit secrets');
  resetAutoLock();
  return vault().auditSecrets();
}

/**
 * System-mode access: bypasses PIN when the caller is the system itself
 * (Docker, Cloudflare Worker, automated cron). Returns null if PIN is
 * required but not verified.
 */
async function getSecretSystem(name) {
  if (isSystemCaller()) return vault().getSecret(name);
  if (!_pinVerified) return null;
  resetAutoLock();
  return vault().getSecret(name);
}

// ─── Helpers ───

async function requirePin(operation) {
  if (isSystemCaller()) return; // Docker/CF Workers have their own injection

  if (!isPinEnrolled()) {
    throw new Error(`PIN not enrolled. Run enrollPin('XXXX') to set up the vault.`);
  }

  if (Date.now() < _lockoutUntil) {
    const remaining = Math.ceil((_lockoutUntil - Date.now()) / 1000);
    throw new Error(`Vault locked. Try again in ${remaining}s.`);
  }

  if (!_pinVerified) {
    throw new Error(`PIN required to ${operation}. Call verifyPin('XXXX') first.`);
  }
}

/** Check if this invocation is an automated system call (not Pete manually). */
function isSystemCaller() {
  if (typeof globalThis !== 'undefined' && typeof globalThis.env !== 'undefined') {
    return true;
  }
  if (process.env.DOCKER_RUNNING === 'true' || process.env.KILO_SESSION) {
    return true;
  }
  if (process.env.VISTAMATIONS_SYSTEM_MODE === 'true') {
    return true;
  }
  return false;
}

// ─── PIN hash storage ───

function readPinHash() {
  if (process.platform === 'win32') {
    try {
      const pwsh = `(Get-StoredCredential -Target '${PIN_TARGET}' -AsCredentialObject -ErrorAction Stop).Password`;
      const result = execSync(
        `powershell -NoProfile -Command "${pwsh}"`,
        { encoding: 'utf8', timeout: 15000, windowsHide: true }
      ).trim();
      if (result && !result.includes('Cannot find') && !result.includes('error')) return result;
    } catch (_) { /* not stored */ }
  } else {
    const pinFile = path.join(require('os').homedir(), 'Vistamations', 'vault', '.pin-hash');
    if (fs.existsSync(pinFile)) return fs.readFileSync(pinFile, 'utf8').trim();
  }
  return null;
}

// ─── scrypt password hashing (matches Handy Mail Gate Manager standard) ───

const SCRYPT_PARAMS = {
  N: 16384,         // CPU cost (Node.js max ~16384 with 64MB default heap)
  r: 8,             // block size
  p: 1,             // parallelization
  keyLength: 64,    // output length
  saltLength: 32,   // salt length
};

function hashScrypt(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(SCRYPT_PARAMS.saltLength);
    crypto.scrypt(
      password,
      salt,
      SCRYPT_PARAMS.keyLength,
      { N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p },
      (err, derivedKey) => {
        if (err) return reject(err);
        // Format: scrypt$N$r$p$salt_hex$key_hex
        resolve(`scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString('hex')}$${derivedKey.toString('hex')}`);
      }
    );
  });
}

function verifyScrypt(password, storedHash) {
  return new Promise((resolve, reject) => {
    const parts = storedHash.split('$');
    if (parts[0] !== 'scrypt' || parts.length !== 6) {
      reject(new Error('Invalid hash format: ' + parts.length + ' parts, first=' + parts[0]));
      return;
    }
    // Format: scrypt$N$r$p$saltHex$keyHex
    // parts[0]='scrypt', parts[1]=N, parts[2]=r, parts[3]=p, parts[4]=saltHex, parts[5]=keyHex
    const N = parseInt(parts[1], 10);
    const r = parseInt(parts[2], 10);
    const p = parseInt(parts[3], 10);
    const salt = Buffer.from(parts[4], 'hex');
    const storedKey = Buffer.from(parts[5], 'hex');

    crypto.scrypt(
      password,
      salt,
      storedKey.length,
      { N, r, p },
      (err, derivedKey) => {
        if (err) return reject(err);
        if (derivedKey.length !== storedKey.length) {
          resolve(false);
          return;
        }
        resolve(crypto.timingSafeEqual(derivedKey, storedKey));
      }
    );
  });
}

// ─── Interactive PIN prompt (for CLI enrollment / key management) ───

async function promptPin() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Enter 4-digit PIN: ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function interactiveEnroll() {
  console.log('\n=== Vistamations Vault — PIN Enrollment ===\n');
  console.log('No PIN is currently set. You must enroll a 4-digit PIN');
  console.log('to manage API keys and secrets.\n');

  let attempts = 0;
  while (attempts < 3) {
    const pin = await promptPin();
    if (!/^\d{4}$/.test(pin)) {
      console.log('PIN must be exactly 4 digits. Try again.\n');
      attempts++;
      continue;
    }
    const confirm = await promptPin();
    if (pin !== confirm) {
      console.log('PINs did not match. Try again.\n');
      attempts++;
      continue;
    }
    try {
      const result = await enrollPin(pin);
      console.log(`\n${result.message} Vault is now secured.\n`);
      return result;
    } catch (err) {
      console.error(`\nError: ${err.message}\n`);
      attempts++;
    }
  }
  console.log('Too many attempts. Run node pin-vault.js again to retry.');
  process.exit(1);
}

async function interactiveVerify() {
  let attempts = 0;
  while (attempts < PIN_MAX_ATTEMPTS) {
    const pin = await promptPin();
    const result = await verifyPin(pin);
    if (result.ok) {
      console.log('PIN verified. Vault unlocked.\n');
      return result;
    }
    console.log(`${result.reason}\n`);
    attempts++;
  }
  throw new Error('Too many failed attempts.');
}

// ─── Exports ───

module.exports = {
  // PIN management
  isPinEnrolled,
  verifyPin,
  enrollPin,
  changePin,
  lockVault,
  pinState,

  // Secret operations (PIN-gated)
  getSecret,
  storeSecret,
  auditSecrets,

  // System-mode (bypass PIN for Docker/Cloudflare/automation)
  getSecretSystem,

  // Interactive helpers
  interactiveEnroll,
  interactiveVerify,

  // Constants
  PIN_LENGTH,
};

// ─── CLI entry point ───
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const cmd = args[0];

    if (cmd === 'enroll') {
      if (isPinEnrolled()) {
        console.log('A PIN is already enrolled. Use "change" to change it.');
        process.exit(0);
      }
      const pin = args[1];
      if (pin) {
        await enrollPin(pin);
        console.log('PIN enrolled.');
      } else {
        await interactiveEnroll();
      }
    } else if (cmd === 'verify') {
      const pin = args[1];
      if (pin) {
        const result = await verifyPin(pin);
        console.log(result.ok ? 'PIN verified.' : result.reason);
      } else {
        await interactiveVerify();
      }
    } else if (cmd === 'change') {
      const oldPin = args[1];
      const newPin = args[2];
      if (oldPin && newPin) {
        const result = await changePin(oldPin, newPin);
        console.log(result.message);
      } else {
        console.log('Enter current PIN:');
        const old = await promptPin();
        console.log('Enter new PIN:');
        const newP = await promptPin();
        const result = await changePin(old, newP);
        console.log(result.message);
      }
    } else if (cmd === 'audit') {
      try {
        await requirePin('audit secrets');
        const results = await vault().auditSecrets();
        console.log('=== Vistamations Vault Audit ===\n');
        let ok = 0, missing = 0;
        for (const r of results) {
          const icon = r.resolved ? 'OK' : (r.required ? 'MISSING' : 'WARN');
          console.log(`[${icon}] ${r.name.padEnd(28)} ${r.resolved ? r.masked.padEnd(12) : 'NOT SET'}  ${r.description}`);
          if (r.resolved) ok++; else if (r.required) missing++;
        }
        console.log(`\n${ok} resolved, ${missing} required secrets missing`);
      } catch (err) {
        console.error(`Error: ${err.message}`);
      }
    } else if (cmd === 'lock') {
      lockVault();
      console.log('Vault locked.');
    } else if (cmd === 'state') {
      console.log(JSON.stringify(pinState(), null, 2));
    } else {
      console.log([
        'Vistamations Vault — PIN-protected secret management',
        '',
        'Commands:',
        '  node pin-vault.js enroll        Interactive PIN enrollment',
        '  node pin-vault.js enroll 1234   Direct PIN enrollment',
        '  node pin-vault.js verify        Interactive PIN verify',
        '  node pin-vault.js verify 1234   Direct PIN verify',
        '  node pin-vault.js change        Interactive PIN change',
        '  node pin-vault.js audit         Audit all secrets (requires PIN)',
        '  node pin-vault.js lock          Lock vault',
        '  node pin-vault.js state         Show PIN state',
        '',
      ].join('\n'));
    }
  })().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
