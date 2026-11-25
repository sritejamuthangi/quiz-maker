const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Short random id for questions and options (unique within one test). */
export function newId(length = 8) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}
