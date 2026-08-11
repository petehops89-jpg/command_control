'use strict';

/**
 * password.js
 *
 * Replaces the original design's `sha256(password)` (assessment,
 * point 2) with scrypt — a deliberately expensive, salted KDF built
 * into Node's crypto module (no native compilation required).
 *
 * IMPORTANT (also from the assessment): a password should not be part
 * of a request's signed authentication envelope at all. Use it only
 * to derive a login/session credential *once*, out of band from the
 * per-request envelope in envelope.js.
 *
 * Production upgrade path: if you want Argon2id specifically, swap
 * this module's internals for the `argon2` npm package (native
 * bindings, needs a build toolchain) behind the same
 * hashPassword/verifyPassword interface — nothing else in the system
 * needs to change.
 */

const crypto = require('crypto');

const KEY_LENGTH = 64;
const SCRYPT_OPTS = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }; // ~128MB, deliberately slow

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTS);
  return `scrypt$${salt.toString('base64')}$${derivedKey.toString('base64')}`;
}

function verifyPassword(password, stored) {
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt') return false;

  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(password, salt, expected.length, SCRYPT_OPTS);

  // Constant-time comparison — never use === on secret material.
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = { hashPassword, verifyPassword };
