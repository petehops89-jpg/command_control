'use strict';

/**
 * setup.js — One-time enrollment: PIN enrollment + key migration into vault.
 *
 * Step 1: Enroll a 4-digit PIN (stores scrypt hash in Credential Manager)
 * Step 2: Scan for existing keys (.env, process env, kilo configs)
 * Step 3: Store keys in Windows Credential Manager (survive reboots)
 * Step 4: Audit all secrets
 *
 * Usage: node setup.js
 */

const { storeSecret, auditSecrets } = require('./vault');
const {
  isPinEnrolled,
  enrollPin,
  interactiveEnroll,
  verifyPin,
  interactiveVerify,
} = require('./pin-vault');
const fs = require('fs');
const path = require('path');

const KEYS_TO_MIGRATE = [
  { name: 'DEEPSEEK_API_KEY', sources: [
    { type: 'env', key: 'DEEPSEEK_API_KEY' },
    { type: 'env', key: 'DEEPSEEK_KEY' },
    { type: 'env', key: 'OPENAI_API_KEY' },
  ]},
  { name: 'GEMINI_API_KEY', sources: [
    { type: 'env', key: 'GEMINI_API_KEY' },
    { type: 'env', key: 'GOOGLE_API_KEY' },
    { type: 'env', key: 'GOOGLE_GENAI_API_KEY' },
  ]},
  { name: 'MISTRAL_API_KEY', sources: [
    { type: 'env', key: 'MISTRAL_API_KEY' },
    { type: 'env', key: 'MISTRAL_KEY' },
  ]},
  { name: 'CLOUDFLARE_API_TOKEN', sources: [
    { type: 'env', key: 'CLOUDFLARE_API_TOKEN' },
    { type: 'env', key: 'CF_API_TOKEN' },
  ]},
];

async function main() {
  console.log('=== Vistamations Vault — PIN Enrollment + Key Migration ===\n');

  // 0. Ensure PinVault tools are available
  const localAppData = process.env.LOCALAPPDATA;
  console.log(`[0/5] System: ${process.platform}, Locale: ${localAppData || 'unknown'}`);

  // 1. PIN enrollment
  console.log('\n[1/5] PIN Enrollment');
  if (isPinEnrolled()) {
    console.log('  A PIN is already enrolled.');
    console.log('  Verify your PIN to proceed with key migration.\n');
    await interactiveVerify();
  } else {
    console.log('  No PIN found. You will now set a 4-digit PIN.\n');
    await interactiveEnroll();
  }

  // 2. Scan existing sources
  console.log('[2/5] Scanning for existing keys...\n');

  const found = {};
  for (const key of KEYS_TO_MIGRATE) {
    for (const source of key.sources) {
      if (source.type === 'env') {
        const val = process.env[source.key];
        if (val) {
          found[key.name] = val;
          console.log(`  Found ${key.name} in process.env.${source.key}`);
          break;
        }
      }
    }
  }

  // 3. Check .env file at project root
  const envPaths = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '..', '.env'),
    'C:\\vistamations-music\\.env',
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      console.log(`  Reading: ${envPath}`);
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const match = line.match(/^(\w+)=(.+)$/);
        if (match) {
          const envKey = match[1].trim();
          const envVal = match[2].trim();
          for (const key of KEYS_TO_MIGRATE) {
            for (const source of key.sources) {
              if (source.type === 'env' && source.key === envKey && !found[key.name]) {
                found[key.name] = envVal;
                console.log(`  Found ${key.name} in ${path.basename(envPath)} (${envKey})`);
              }
            }
          }
        }
      }
    }
  }

  if (Object.keys(found).length === 0) {
    console.log('  No keys found in .env or process environment.');
    console.log('  You will need to manually add keys with:');
    console.log('    node vault.js store DEEPSEEK_API_KEY sk-...');
    console.log('    node vault.js store GEMINI_API_KEY ...\n');
  }

  // 4. Store found keys into vault
  console.log('\n[3/5] Storing keys in Windows Credential Manager...\n');

  let stored = 0;
  for (const [name, value] of Object.entries(found)) {
    if (value && value.length > 4) {
      try {
        storeSecret(name, value);
        console.log(`  [OK] ${name} stored (${value.substring(0, 8)}...)`);
        stored++;
      } catch (e) {
        console.log(`  [FAIL] ${name}: ${e.message}`);
      }
    }
  }

  // 5. Audit
  console.log(`\n[4/5] Audit (${stored} keys stored)\n`);

  const results = await auditSecrets();
  let ok = 0, missing = 0;
  for (const r of results) {
    const icon = r.resolved ? '[OK]' : (r.required ? '[MISSING]' : '[WARN]');
    console.log(`  ${icon} ${r.name.padEnd(28)} ${r.resolved ? r.masked.padEnd(12) : 'NOT SET'}  ${r.description}`);
    if (r.resolved) ok++; else if (r.required) missing++;
  }
  console.log(`\n  ${ok} resolved, ${missing} required secrets missing`);

  // 6. Security recommendation
  console.log('\n[5/5] Security recommendations:');
  console.log('  1. Remove API keys from C:\\vistamations-music\\.env (it is in .gitignore)');
  console.log('  2. Docker will auto-inject keys via docker-compose.yml (no .env needed)');
  console.log('  3. Cloudflare Workers get keys via wrangler secret (separate setup)');
  console.log('  4. To add a new key: node vault.js store KEY_NAME value');
  console.log('  5. To audit: node vault.js audit');
  console.log('  6. Lock vault: node pin-vault.js lock');
  console.log('');
}

main().catch(e => { console.error('Setup failed:', e.message); process.exit(1); });
