'use strict';

/**
 * enroll.js — One-shot vault enrollment: stores all known keys into
 * Windows Credential Manager. Requires PIN to be already enrolled.
 *
 * This is the manual key injection script. It reads keys from:
 *   1. .env file
 *   2. environment variables
 *   3. Command-line arguments
 *
 * Usage:
 *   node enroll.js                              # scan .env + process.env
 *   node enroll.js DEEPSEEK_API_KEY=sk-xxx       # inject a single key
 *   node enroll.js --list                        # list what would be enrolled
 */

const { POSITIVE, NEGATIVE } = 'pos neg'.split(' ');
const path = require('path');
const fs = require('fs');
const { storeSecret, getSecret, auditSecrets, SECRET_REGISTRY } = require('./vault');
const { isPinEnrolled, verifyPin, interactiveVerify, pinState } = require('./pin-vault');

async function main() {
  console.log('=== Vistamations Vault — Key Enrollment ===\n');

  const args = process.argv.slice(2);

  // ── Phase 1: PIN gate ──

  if (!isPinEnrolled()) {
    console.error('No PIN enrolled. Run `node pin-vault.js enroll` first.');
    process.exit(1);
  }

  console.log('PIN check: enrolled');
  console.log('Verify your PIN to proceed.\n');

  const result = await interactiveVerify();
  if (!result.ok) {
    console.log('PIN verification failed.');
    process.exit(1);
  }

  // ── Phase 2: Collect keys ──

  const toEnroll = {};

  // Process command-line key=value pairs
  for (const arg of args) {
    if (arg === '--list') {
      console.log('=== Registered secrets (from vault.js) ===\n');
      for (const [name, entry] of Object.entries(SECRET_REGISTRY)) {
        const stored = await getSecret(name);
        console.log(`  ${name.padEnd(28)} ${stored ? '(stored) ' + stored.substring(0, 8) + '...' : '(missing)'}  ${entry.description}`);
      }
      console.log('');
      process.exit(0);
    }
    const match = arg.match(/^(\w+)=(.+)$/);
    if (match) {
      const [_, key, val] = match;
      if (SECRET_REGISTRY[key]) {
        toEnroll[key] = val;
        console.log(`  CLI: ${key} = ${val.substring(0, 8)}...`);
      } else {
        console.log(`  Skip: ${key} (not in SECRET_REGISTRY)`);
      }
    }
  }

  // Scan .env file
  const envPaths = [
    path.join(process.cwd(), '.env'),
    'C:\\vistamations-music\\.env',
  ];
  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    console.log(`\n  Reading: ${envPath}`);
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const match = line.match(/^(\w+)=(.+)$/);
      if (!match) continue;
      const envKey = match[1].trim();
      const envVal = match[2].trim();
      if (envKey.startsWith('#') || !envVal) continue;

      // Map .env keys to registry keys
      for (const [regName, regEntry] of Object.entries(SECRET_REGISTRY)) {
        if (
          regName === envKey ||
          (regEntry.credentialTarget && regEntry.credentialTarget.endsWith(envKey.replace(/_/g, '').replace('APIKEY', '').replace('APITOKEN', ''))) ||
          envKey === regEntry.cloudflareSecret
        ) {
          if (!toEnroll[regName] && envVal.length > 4) {
            toEnroll[regName] = envVal;
            console.log(`  .env: ${regName} (from ${envKey}) = ${envVal.substring(0, 8)}...`);
          }
          break;
        }
      }

      // Direct match: .env key exactly matches registry key
      if (SECRET_REGISTRY[envKey] && !toEnroll[envKey]) {
        toEnroll[envKey] = envVal;
        console.log(`  .env: ${envKey} = ${envVal.substring(0, 8)}...`);
      }
    }
  }

  // Scan process environment
  for (const [regName] of Object.entries(SECRET_REGISTRY)) {
    if (toEnroll[regName]) continue;
    const envVal = process.env[regName];
    if (envVal && envVal.length > 4) {
      toEnroll[regName] = envVal;
      console.log(`  env: ${regName} = ${envVal.substring(0, 8)}...`);
    }
  }

  if (Object.keys(toEnroll).length === 0) {
    console.log('\nNo keys found to enroll.');
    console.log('Provide them manually:');
    console.log('  node enroll.js DEEPSEEK_API_KEY=sk-xxx GEMINI_API_KEY=... CLOUDFLARE_API_TOKEN=...');
    process.exit(0);
  }

  // ── Phase 3: Store into Credential Manager ──

  console.log('\n=== Storing keys into Windows Credential Manager ===\n');

  let stored = 0;
  let failed = 0;
  for (const [name, value] of Object.entries(toEnroll)) {
    try {
      storeSecret(name, value);
      console.log(`  [OK] ${name.padEnd(28)} ${value.substring(0, 8)}...`);
      stored++;
    } catch (e) {
      console.log(`  [FAIL] ${name.padEnd(28)} ${e.message}`);
      failed++;
    }
  }

  // ── Phase 4: Audit ──

  console.log(`\n=== Audit (${stored} stored, ${failed} failed) ===\n`);

  const results = await auditSecrets();
  let ok = 0, missing = 0, warn = 0;
  for (const r of results) {
    const icon = r.resolved ? '  OK' : (r.required ? 'MISS' : 'WARN');
    console.log(`  [${icon}] ${r.name.padEnd(28)} ${r.resolved ? r.masked.padEnd(14) : 'NOT SET'}  ${r.description}`);
    if (r.resolved) ok++; else if (r.required) missing++; else warn++;
  }
  console.log(`\n  ${ok} resolved | ${missing} required missing | ${warn} optional missing`);

  // ── Next steps ──

  console.log('\n=== Next Steps ===');
  if (missing > 0) {
    console.log('  Run again with missing keys:');
    console.log('    node enroll.js DEEPSEEK_API_KEY=sk-xxx GEMINI_API_KEY=... CLOUDFLARE_API_TOKEN=...');
  }
  if (stored > 0) {
    console.log('  Keys are now in Windows Credential Manager. They survive reboots.');
    console.log('  The .env file at C:\\vistamations-music\\.env can be simplified.');
  }
  console.log('');
}

main().catch(e => { console.error('Enrollment failed:', e.message); process.exit(1); });
