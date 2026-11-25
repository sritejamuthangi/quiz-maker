import { formatIssues, questionSchema } from '@shared/schema.js';
import { newId } from './ids.js';

/** Columns of the downloadable template (also accepted in any order, with common alternative names). */
export const TEMPLATE_HEADERS = [
  'Type',
  'Question',
  'Option A',
  'Option B',
  'Option C',
  'Option D',
  'Option E',
  'Option F',
  'Correct',
  'Explanation',
  'Points',
];

export const TEMPLATE_ROWS = [
  ['Multiple choice', 'What is the capital of France?', 'Berlin', 'Paris', 'Madrid', 'Rome', '', '', 'B', 'Paris has been the capital of France for centuries.', 1],
  ['Checkboxes', 'Which of these are prime numbers?', '2', '4', '7', '9', '', '', 'A, C', 'A prime number has exactly two divisors: 1 and itself.', 2],
  ['True/False', 'The Earth orbits the Sun.', '', '', '', '', '', '', 'True', 'One orbit takes about 365 days.', 1],
  ['Fill in the blank', 'Water is made of hydrogen and ___.', '', '', '', '', '', '', 'oxygen', 'H2O: two hydrogen atoms and one oxygen atom.', 1],
  ['Fill in the blank', 'The chemical symbol for gold is [Au] and for silver is [Ag].', '', '', '', '', '', '', '', 'From the Latin words aurum and argentum.', 1],
];

const key = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const TYPE_ALIASES = {
  single: ['single', 'mcq', 'multiplechoice', 'choice', 'radio', 'singlechoice', 'singleanswer', 'one'],
  multiple: ['multiple', 'multi', 'checkbox', 'checkboxes', 'multipleanswer', 'multipleanswers', 'multiselect', 'multipleselect', 'multiplecorrect', 'msq'],
  truefalse: ['truefalse', 'tf', 'boolean', 'trueorfalse', 'yesno'],
  blank: ['blank', 'blanks', 'fill', 'fillintheblank', 'fillintheblanks', 'fillblank', 'fillblanks', 'fib', 'shortanswer', 'text', 'gap', 'cloze'],
};

function parseType(raw) {
  const k = key(raw);
  if (!k) return null;
  for (const [type, aliases] of Object.entries(TYPE_ALIASES)) if (aliases.includes(k)) return type;
  throw new Error(`Unknown type "${raw}". Use Multiple choice, Checkboxes, True/False or Fill in the blank.`);
}

function parseBool(raw) {
  const k = key(raw);
  if (['true', 't', 'yes', 'y', '1', 'correct', 'right'].includes(k)) return true;
  if (['false', 'f', 'no', 'n', '0', 'incorrect', 'wrong'].includes(k)) return false;
  return null;
}

function parsePoints(raw) {
  if (raw === '' || raw == null) return 1;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error('Points must be a whole number from 1 to 100.');
  return n;
}

function findColumns(headerRow) {
  const cols = { options: [] };
  headerRow.forEach((cell, index) => {
    const k = key(cell);
    if (['type', 'questiontype'].includes(k)) cols.type ??= index;
    else if (['question', 'questiontext', 'text', 'prompt'].includes(k)) cols.question ??= index;
    else if (['correct', 'correctanswer', 'correctanswers', 'answer', 'answers', 'key'].includes(k)) cols.correct ??= index;
    else if (['explanation', 'explain', 'reason', 'feedback'].includes(k)) cols.explanation ??= index;
    else if (['points', 'point', 'marks', 'mark', 'score'].includes(k)) cols.points ??= index;
    else {
      const match = /^(?:option|choice)?([a-f]|[1-6])$/.exec(k);
      if (match) {
        const slot = /[a-f]/.test(match[1]) ? match[1].charCodeAt(0) - 97 : Number(match[1]) - 1;
        cols.options[slot] ??= index;
      }
    }
  });
  return cols;
}

const DEFAULT_COLUMNS = { type: 0, question: 1, options: [2, 3, 4, 5, 6, 7], correct: 8, explanation: 9, points: 10 };

function escapeBrackets(text) {
  return text.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

/** "Water is made of hydrogen and ___." + "oxygen"  →  "Water is made of hydrogen and [oxygen]." */
function toBracketText(text, correctRaw) {
  if (text.includes('[')) return text;
  const gaps = text.match(/_{3,}/g) ?? [];
  const answers = correctRaw
    .split(';')
    .map((a) => a.trim())
    .filter(Boolean);
  if (gaps.length === 0) {
    throw new Error('Mark where the blank goes with ___ (three underscores), or put the answer in [brackets].');
  }
  if (answers.length !== gaps.length) {
    throw new Error(
      `The question has ${gaps.length} blank(s) (___) but the Correct column has ${answers.length} answer(s). Separate answers with ";".`,
    );
  }
  let i = 0;
  return text.replace(/_{3,}/g, () => `[${escapeBrackets(answers[i++])}]`);
}

function resolveOption(token, optionTexts, idBySlot) {
  if (!token) return null;
  let slot = -1;
  if (/^[a-f]$/i.test(token)) slot = token.toLowerCase().charCodeAt(0) - 97;
  else {
    slot = optionTexts.findIndex((t) => t && t.toLowerCase() === token.toLowerCase());
    if (slot === -1 && /^[1-6]$/.test(token)) slot = Number(token) - 1;
  }
  return idBySlot[slot] ?? null;
}

function rowToQuestion(row, cols) {
  const get = (i) => (i === undefined ? '' : (row[i] ?? ''));
  const text = get(cols.question);
  if (!text) throw new Error('The question is empty.');
  const optionTexts = cols.options.map((i) => get(i));
  const correctRaw = get(cols.correct);
  const explanation = get(cols.explanation);
  const points = parsePoints(get(cols.points));

  let type = parseType(get(cols.type));
  if (!type) {
    if (text.includes('[') || /_{3,}/.test(text)) type = 'blank';
    else if (optionTexts.some(Boolean)) type = /[,;]/.test(correctRaw) ? 'multiple' : 'single';
    else if (parseBool(correctRaw) !== null) type = 'truefalse';
    else throw new Error('Set the Type column (Multiple choice, Checkboxes, True/False or Fill in the blank).');
  }

  if (type === 'single' || type === 'multiple') {
    const options = [];
    const idBySlot = {};
    optionTexts.forEach((optionText, slot) => {
      if (!optionText) return;
      const id = newId(6);
      idBySlot[slot] = id;
      options.push({ id, text: optionText });
    });
    const tokens = type === 'single' ? [correctRaw.trim()] : correctRaw.split(/[,;|]/).map((t) => t.trim());
    const ids = tokens.map((t) => resolveOption(t, optionTexts, idBySlot)).filter(Boolean);
    if (!correctRaw) throw new Error('The Correct column is empty. Put the letter of the right option, like B.');
    if (ids.length !== tokens.filter(Boolean).length) {
      throw new Error(`"${correctRaw}" doesn't match the options. Use letters like B (or A, C for checkboxes).`);
    }
    return {
      id: newId(),
      type,
      text,
      options,
      correct: type === 'single' ? ids[0] : [...new Set(ids)],
      explanation,
      points,
    };
  }

  if (type === 'truefalse') {
    const value = parseBool(correctRaw);
    if (value === null) throw new Error('For True/False questions, the Correct column must be True or False.');
    return { id: newId(), type, text, correct: value, explanation, points };
  }

  return { id: newId(), type: 'blank', text: toBracketText(text, correctRaw), caseSensitive: false, explanation, points };
}

const cellToText = (cell) => {
  if (cell == null) return '';
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return String(cell).trim();
};

/**
 * Turns spreadsheet rows into questions.
 * @param {Array<Array<unknown>>} rows  first row may be a header row
 * @returns {{ questions: object[], errors: Array<{ row: number, message: string }> }}
 */
export function rowsToQuestions(rows) {
  const table = (rows ?? []).map((row) => (Array.isArray(row) ? row.map(cellToText) : []));
  const header = findColumns(table[0] ?? []);
  const hasHeader = header.question !== undefined;
  // With a header row, use only the columns it names (any order); without one, assume the template order.
  const cols = hasHeader ? header : DEFAULT_COLUMNS;

  const questions = [];
  const errors = [];
  for (let r = hasHeader ? 1 : 0; r < table.length; r += 1) {
    const row = table[r];
    if (row.every((cell) => cell === '')) continue;
    try {
      const parsed = questionSchema.safeParse(rowToQuestion(row, cols));
      if (parsed.success) questions.push(parsed.data);
      else errors.push({ row: r + 1, message: formatIssues(parsed.error)[0]?.message ?? 'Invalid question.' });
    } catch (error) {
      errors.push({ row: r + 1, message: error.message });
    }
  }
  return { questions, errors };
}

/** Reads an uploaded .xlsx or .csv file into rows. */
export async function readQuestionFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || file.type === 'text/csv') {
    const Papa = (await import('papaparse')).default;
    const text = await file.text();
    const parsed = Papa.parse(text.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' });
    if (parsed.errors.some((e) => e.type === 'Quotes')) {
      throw new Error('The CSV contains an unclosed or misplaced quote. Save it as CSV again and retry.');
    }
    return parsed.data;
  }
  if (name.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser');
    return readSheet(file);
  }
  throw new Error('Please choose an .xlsx or .csv file. (Old .xls files: open in Excel and "Save As" .xlsx.)');
}
