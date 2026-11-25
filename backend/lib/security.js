import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { correctAnswerOf, toPublicQuestion } from '../../shared/grading.js';

// Public test ids: 10 characters without look-alikes (no 0/o, 1/l/i), easy to read out loud.
const PUBLIC_ID_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
export const PUBLIC_ID_RE = /^[2-9a-hjkmnp-z]{10}$/;
const ADMIN_KEY_RE = /^[A-Za-z0-9_-]{32}$/;

export function newPublicId() {
  let id = '';
  for (let i = 0; i < 10; i += 1) id += PUBLIC_ID_ALPHABET[randomInt(PUBLIC_ID_ALPHABET.length)];
  return id;
}

/** 192-bit secret that unlocks a test's results. Only its SHA-256 hash is stored. */
export function newAdminKey() {
  return randomBytes(24).toString('base64url');
}

export function hashAdminKey(key) {
  return createHash('sha256').update(key).digest('hex');
}

const DUMMY_HASH = hashAdminKey('dummy');

/** Constant-time check of an admin key against a stored hash. */
export function adminKeyMatches(key, storedHash) {
  const valid = typeof key === 'string' && ADMIN_KEY_RE.test(key) && typeof storedHash === 'string';
  const given = Buffer.from(hashAdminKey(valid ? key : 'invalid'), 'hex');
  const expected = Buffer.from(valid && storedHash.length === 64 ? storedHash : DUMMY_HASH, 'hex');
  return timingSafeEqual(given, expected) && valid;
}

export function bearerToken(req) {
  const header = req.get('authorization') || '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? match[1] : '';
}

/** Equal-length, constant-time string comparison (for the cron secret). */
export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/** IP addresses are only ever stored as a keyed hash (for rate limits), never in plain text. */
export function hashIp(secret, ip) {
  return createHmac('sha256', secret).update(`ip:${ip}`).digest('hex').slice(0, 32);
}

export function clientIp(req, config) {
  if (config.isVercel) {
    // Vercel sets these itself; clients can't spoof them.
    const real = req.get('x-real-ip');
    if (real) return real.trim();
    const forwarded = req.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

// ---------------------------------------------------------------------------
// Attempt tokens: issued when someone presses "Start", required to submit.
// They carry the start time and the random seed (question selection/shuffle),
// signed with HMAC so they can't be forged. No database write is needed to start.
// ---------------------------------------------------------------------------

function sign(secret, body) {
  return createHmac('sha256', secret).update(`attempt:${body}`).digest();
}

export function signAttemptToken(secret, payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(secret, body).toString('base64url')}`;
}

/** Bind an attempt to the questions/rules it started with. Keyed, so the digest
 * cannot be used to guess a short answer key offline. Explanations and result
 * visibility may change without invalidating someone's in-progress attempt. */
export function attemptVersion(secret, test) {
  const s = test.settings;
  const definition = {
    questions: test.questions.map((q) => ({
      ...toPublicQuestion(q),
      answer: correctAnswerOf(q),
      caseSensitive: !!q.caseSensitive,
    })),
    selection: [s.questionsPerAttempt ?? null, !!s.shuffleQuestions, !!s.shuffleOptions],
    rules: [s.timeLimitMinutes ?? null, s.requireName !== false, s.extraFieldLabel ?? ''],
  };
  return createHmac('sha256', secret).update(`attempt-version:${JSON.stringify(definition)}`).digest('base64url');
}

export function verifyAttemptToken(secret, token) {
  if (typeof token !== 'string' || token.length > 2000) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const given = Buffer.from(signature, 'base64url');
  const expected = sign(secret, body);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    const valid =
      p &&
      typeof p.t === 'string' &&
      Number.isSafeInteger(p.s) &&
      typeof p.n === 'string' &&
      p.n.length >= 16 &&
      p.n.length <= 32 &&
      Number.isInteger(p.r) &&
      p.r >= 0 &&
      p.r <= 0xffffffff &&
      typeof p.v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(p.v);
    return valid ? p : null;
  } catch {
    return null;
  }
}

export function newAttemptNonce() {
  return randomBytes(16).toString('base64url');
}

export function newSeed() {
  return randomBytes(4).readUInt32LE(0);
}
