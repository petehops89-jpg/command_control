/** @type {import('eslint').Linter.Config} */
module.exports = {
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
  },
  extends: ['eslint:recommended'],
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off',
    'no-constant-condition': ['error', { checkLoops: false }],
    'require-atomic-updates': 'warn',
    'no-async-promise-executor': 'warn',
    'no-prototype-builtins': 'warn',
  },
  ignorePatterns: ['node_modules/', 'cloudflare/', '.wrangler/', 'mya/', 'vistamations-home-bento/'],
};
