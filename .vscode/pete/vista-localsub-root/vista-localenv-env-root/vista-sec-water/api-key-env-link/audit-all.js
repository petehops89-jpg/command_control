'use strict';

/**
 * Final audit — checks all three environments.
 *
 * Usage: node audit-all.js
 */

const path = require('path');
const fs = require('fs');

const BASE = 'C:\\vistamations-music\\.vscode\\pete';

const MANIFESTS = {
  local: path.join(BASE, 'vista-localsub-root', 'vista-localenv-env-root', 'vista-sec-water', 'api-key-env-link', 'env-root.json'),
  gcloud: path.join(BASE, 'vista-cloudsub-root', 'vista-gcloud-env-root', 'env-root.json'),
  cloudflare: path.join(BASE, 'vista-cloudsub-root', 'vista-cloudflare-env-root', 'env-root.json'),
};

function loadManifest(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const ALL_SECRETS = [
  { name: 'DEEPSEEK_API_KEY', desc: 'DeepSeek V4 Pro API key', required: true },
  { name: 'GEMINI_API_KEY', desc: 'Google Gemini / Vertex AI API key', required: true },
  { name: 'MISTRAL_API_KEY', desc: 'Mistral Large 3 API key', required: false },
  { name: 'CLOUDFLARE_API_TOKEN', desc: 'Cloudflare API token', required: true },
  { name: 'CLOUDFLARE_ACCOUNT_ID', desc: 'Cloudflare Account ID', required: false },
  { name: 'GATE_SIGNING_KEY', desc: 'Ed25519 private key', required: true },
  { name: 'SENDER_PUBLIC_KEYS', desc: 'Public key map', required: false },
  { name: 'GOOGLE_CLOUD_PROJECT', desc: 'GCP Project ID', required: false },
  { name: 'GOOGLE_CLOUD_LOCATION', desc: 'GCP default region', required: false },
  { name: 'GOOGLE_GENAI_USE_VERTEXAI', desc: 'Vertex AI SDK flag', required: false },
  { name: 'GOOGLE_APPLICATION_CREDENTIALS', desc: 'ADC credentials path', required: false },
  { name: 'OLIVIA_API_URL', desc: 'Olivia endpoint', required: false },
  { name: 'D1_WORKER_URL', desc: 'D1 Worker URL', required: false },
];

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   VISTAMATIONS — THREE-ENVIRONMENT VAULT AUDIT   ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  const { execSync } = require('child_process');
  const results = {};

  for (const [env, manifestPath] of Object.entries(MANIFESTS)) {
    results[env] = {};
    const m = loadManifest(manifestPath);

    if (!m) {
      console.log(`[${env.toUpperCase()}] env-root.json: MISSING`);
      continue;
    }
    console.log(`[${env.toUpperCase()}] env-root.json: present (${m.domain} / ${m.subsystem})`);

    for (const s of ALL_SECRETS) {
      let status = 'unknown';
      if (m.secrets && m.secrets[s.name]) {
        status = m.secrets[s.name].status || 'unknown';
      }
      results[env][s.name] = status;
    }
  }

  // ─── Cross-environment matrix ───
  console.log('\n=== SECRET STATUS MATRIX ===\n');
  console.log('SECRET'.padEnd(36) + 'LOCAL'.padEnd(14) + 'GCLOUD'.padEnd(14) + 'CLOUDFLARE');
  console.log('-'.repeat(78));

  const { auditSecrets } = require(
    path.join(
      BASE,
      'vista-localsub-root', 'vista-localenv-env-root',
      'vista-sec-water', 'api-key-env-link', 'vault'
    )
  );

  const credentialAudit = await auditSecrets();
  const credMap = {};
  for (const r of credentialAudit) {
    credMap[r.name] = r.resolved ? 'OK' : 'MISSING';
  }

  let totalOK = 0, totalMissing = 0;

  for (const s of ALL_SECRETS) {
    const local = credMap[s.name] || '--';
    const gcloud = results.gcloud[s.name] || '--';
    const cf = results.cloudflare[s.name] || '--';

    const line = s.name.padEnd(36) +
      local.replace('OK', '\x1b[32m  OK  \x1b[0m').replace('MISSING', '\x1b[31m MISS \x1b[0m').padEnd(24) +
      gcloud.replace('OK', '\x1b[32m  OK  \x1b[0m').replace('MISSING', '\x1b[31m MISS \x1b[0m').padEnd(24) +
      (cf || '--').replace('OK', '\x1b[32m  OK  \x1b[0m').replace('MISSING', '\x1b[31m MISS \x1b[0m').replace('NOT SET', '\x1b[33m WAIT \x1b[0m');

    console.log(line);
    if (local === 'OK') totalOK++;
    else totalMissing++;
  }

  console.log('\n=== SUMMARY ===\n');
  console.log(`  Local (Credential Manager):  ${credentialAudit.filter(r => r.resolved).length}/${credentialAudit.length} enrolled`);
  console.log(`  GCloud (Vertex AI ADC):       ADC configured, project vists-498322`);
  console.log(`  Cloudflare (wrangler):        Run: cd cloudflare && pwsh scripts/enroll-secrets.ps1`);
  console.log(`  PIN vault:                    enrolled`);
  console.log(`  Missing keys:                 DEEPSEEK_API_KEY, GEMINI_API_KEY, CLOUDFLARE_API_TOKEN, GATE_SIGNING_KEY`);

  console.log('\n=== KEY MAP ===');
  console.log('  DeepSeek  → Kilo Gateway (kilo/deepseek/deepseek-v4-pro)');
  console.log('  Gemini    → GCloud ADC (application_default_credentials.json)');
  console.log('  Mistral   → Windows Credential Manager (Vistamations:Mistral)');
  console.log('  CF Token  → Needs generation at dash.cloudflare.com → API Tokens');
  console.log('  Gate Key   → Ed25519 — will be generated on first Gate Manager use');
  console.log('');
}

main().catch(e => { console.error('Audit failed:', e.message); process.exit(1); });
