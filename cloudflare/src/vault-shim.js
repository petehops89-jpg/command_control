/**
 * Vistamations Worker Vault Shim
 *
 * For Cloudflare Workers, API keys are stored as wrangler secrets
 * (set via `npx wrangler secret put`). They appear on `env.<KEY>`.
 *
 * This module just re-exports env so the caching logic in the main
 * worker can be extended with vault lookups without changing worker.js.
 *
 * USAGE (in worker.js):
 *   import { getSecret } from './vault-shim';
 *   const geminiKey = getSecret(env, 'GEMINI_API_KEY');
 */

export function getSecret(env, name) {
  if (!env) return null;

  const SECRET_MAP = {
    DEEPSEEK_API_KEY: 'DEEPSEEK_API_KEY',
    GEMINI_API_KEY: 'GOOGLE_API_KEY',
    MISTRAL_API_KEY: 'MISTRAL_API_KEY',
    CLOUDFLARE_API_TOKEN: 'CLOUDFLARE_API_TOKEN',
    OLIVIA_API_URL: 'OLIVIA_API_URL',
    D1_WORKER_URL: 'D1_WORKER_URL',
  };

  const envKey = SECRET_MAP[name] || name;
  return env[envKey] || null;
}

/**
 * Audit all registered secrets in this environment.
 */
export function auditSecrets(env) {
  const results = [];
  for (const [name, envKey] of Object.entries({
    DEEPSEEK_API_KEY: 'DEEPSEEK_API_KEY',
    GEMINI_API_KEY: 'GOOGLE_API_KEY',
    MISTRAL_API_KEY: 'MISTRAL_API_KEY',
    CLOUDFLARE_API_TOKEN: 'CLOUDFLARE_API_TOKEN',
  })) {
    results.push({
      name,
      resolved: !!env[envKey],
      source: env[envKey] ? 'env binding' : 'MISSING',
    });
  }
  return results;
}
