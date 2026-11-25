import { LIMITS } from './limits.js';

/**
 * Fill-in-the-blank questions are written as plain text with the answers in square brackets:
 *
 *   "The capital of France is [Paris]."
 *   "It is spelled [colour|color] in the UK."   (| separates accepted alternatives)
 *   "Use \[ and \] for literal brackets."
 *
 * parseBlanks() turns that into display segments (with no answers in them) and the list of
 * accepted answers per blank.
 *
 * @param {string} text
 * @returns {{ segments: Array<{type:'text', value:string}|{type:'blank', index:number}>, blanks: string[][], error: string|null }}
 */
export function parseBlanks(text) {
  const source = String(text ?? '');
  const segments = [];
  const blanks = [];
  let textBuffer = '';
  let blankBuffer = '';
  let inBlank = false;

  const fail = (error) => ({ segments, blanks, error });

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === '\\' && (next === '[' || next === ']')) {
      if (inBlank) blankBuffer += next;
      else textBuffer += next;
      i += 1;
      continue;
    }

    if (ch === '[') {
      if (inBlank) return fail('A blank cannot contain "[". Close the first blank with "]" before opening another.');
      inBlank = true;
      blankBuffer = '';
      if (textBuffer) {
        segments.push({ type: 'text', value: textBuffer });
        textBuffer = '';
      }
      continue;
    }

    if (ch === ']') {
      if (!inBlank) return fail('Found "]" without a matching "[".');
      inBlank = false;
      const number = blanks.length + 1;
      const alternatives = [];
      for (const raw of blankBuffer.split('|')) {
        const value = raw.replace(/\s+/g, ' ').trim();
        if (value && !alternatives.includes(value)) alternatives.push(value);
      }
      if (alternatives.length === 0) return fail(`Blank ${number} is empty. Put the answer inside the brackets, like [Paris].`);
      if (alternatives.length > LIMITS.blankAlternativesMax) {
        return fail(`Blank ${number} has too many alternatives (max ${LIMITS.blankAlternativesMax}).`);
      }
      if (alternatives.some((a) => a.length > LIMITS.blankAnswerMax)) {
        return fail(`An answer in blank ${number} is too long (max ${LIMITS.blankAnswerMax} characters).`);
      }
      blanks.push(alternatives);
      segments.push({ type: 'blank', index: blanks.length - 1 });
      if (blanks.length > LIMITS.blanksMax) return fail(`A question can have at most ${LIMITS.blanksMax} blanks.`);
      continue;
    }

    if (inBlank) blankBuffer += ch;
    else textBuffer += ch;
  }

  if (inBlank) return fail('A blank is missing its closing "]".');
  if (textBuffer) segments.push({ type: 'text', value: textBuffer });
  return { segments, blanks, error: null };
}

/** Question text with each blank replaced by a placeholder, e.g. for spreadsheets. */
export function textWithBlanks(text, placeholder = '_____') {
  const { segments, error } = parseBlanks(text);
  if (error) return String(text ?? '');
  return segments.map((s) => (s.type === 'text' ? s.value : placeholder)).join('');
}

const SINGLE_QUOTES = /[‘’‚‛′`´]/g;
const DOUBLE_QUOTES = /[“”„‟″]/g;
const DASHES = /[‐‑‒–—―−]/g;
const TRAILING_PUNCTUATION = /[\s.,;:!?。、！？，]+$/u;

/**
 * Normalises a typed answer so small differences don't make it "wrong":
 * extra spaces, phone "smart" quotes and dashes, trailing punctuation and (by default) letter case.
 */
export function normalizeAnswer(value, caseSensitive = false) {
  let s = String(value ?? '')
    .normalize('NFKC')
    .replace(SINGLE_QUOTES, "'")
    .replace(DOUBLE_QUOTES, '"')
    .replace(DASHES, '-')
    .replace(/\s+/gu, ' ')
    .trim();
  const withoutPunctuation = s.replace(TRAILING_PUNCTUATION, '');
  // Keep the punctuation if it IS the answer (e.g. "[?]").
  if (withoutPunctuation) s = withoutPunctuation;
  return caseSensitive ? s : s.toLowerCase();
}

/** True when the typed answer matches one of the accepted alternatives. Empty answers never match. */
export function answerMatches(given, alternatives, caseSensitive = false) {
  if (String(given ?? '').trim() === '') return false;
  const normalizedGiven = normalizeAnswer(given, caseSensitive);
  return alternatives.some((alt) => normalizeAnswer(alt, caseSensitive) === normalizedGiven);
}
