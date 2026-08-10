'use strict';

/**
 * setup.js — One-time migration: move existing API keys into the vault.
 *
 * This reads keys from wherever they currently live (.env, kilo.jsonc,
 * process env) and stores them into Windows Credential Manager (or the
 * encrypted local vault on non-Windows).
 *
 * Usage: node setup.js
 */

const { storeSecret, auditSecrets } = require('./vault');
const fs = require('fs');
const path = require('path');

const KEYS_TO_MIGRATE = [
  { name: 'DEEPSEEK_API_KEY', sources: [
    { type: 'env', key: 'DEEPSEEK_API_KEY' },
    { type: 'env', key: 'DEEPSEEK_KEY' },
    { type: 'env', key: 'OPENAI_API_KEY' }, // sometimes misnamed
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
  console.log('=== Vistamations Vault — Key Migration ===\n');

  // 1. Scan existing sources
  console.log('[1/3] Scanning for existing keys...\n');

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

  // 2. Check .env file
  const envPaths = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '..', '.env'),
    'C:\\vistamations-music\\.env',
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
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
                console.log(`  Found ${key.name} in ${envPath}`);
              }
            }
          }
        }
      }
    }
  }

  // 3. Store found keys into vault
  console.log('\n[2/3] Storing keys in vault...\n');

  let stored = 0;
  for (const [name, value] of Object.entries(found)) {
    if (value && value.length > 4) {
      try {
        storeSecret(name, value);
        console.log(`  ✅ ${name} stored (${value.substring(0, 8)}...)`);
        stored++;
      } catch (e) {
        console.log(`  ❌ ${name} failed: ${e.message}`);
      }
    }
  }

  // 4. Audit
  console.log(`\n[3/3] Audit (${stored} keys stored)\n`);

  const results = await auditSecrets();
  for (const r of results) {
    const icon = r.resolved ? '✅' : (r.required ? '❌' : '⚠️');
    console.log(`  ${icon} ${r.name.padEnd(28)} ${r.resolved ? r.masked : 'NOT SET'}`);
  }

  console.log('\nDone. Keys are now in Windows Credential Manager and survive reboots.');
  console.log('You can now remove API keys from .env files (keep .env in .gitignore).');
}

main().catch(e => { console.error('Setup failed:', e.message); process.exit(1); });
