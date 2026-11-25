import { parseBlanks, answerMatches } from './blanks.js';
import { LIMITS } from './limits.js';
import { hash32, mulberry32, shuffled } from './random.js';

const pointsOf = (q) => (Number.isInteger(q.points) && q.points > 0 ? q.points : 1);

// ---------------------------------------------------------------------------
// Which questions a person gets, and in which order
// ---------------------------------------------------------------------------

/**
 * Deterministically picks the questions shown in one attempt.
 * - "Random N questions per person" picks N questions (kept in the author's order unless shuffling).
 * - "Shuffle questions" shuffles the order.
 * The same seed always gives the same result, so the server can grade exactly what was shown.
 */
export function selectQuestionIds(questions, settings, seed) {
  const rng = mulberry32(seed);
  let ids = questions.map((q) => q.id);
  const n = settings?.questionsPerAttempt;
  if (Number.isInteger(n) && n > 0 && n < ids.length) {
    const picked = new Set(shuffled(ids, rng).slice(0, n));
    ids = ids.filter((id) => picked.has(id));
  }
  if (settings?.shuffleQuestions) ids = shuffled(ids, rng);
  return ids;
}

/** A question as sent to a test-taker: never contains answers or explanations. */
export function toPublicQuestion(q, { shuffleOptions = false, seed = 0 } = {}) {
  const base = { id: q.id, type: q.type, points: pointsOf(q) };
  if (q.type === 'single' || q.type === 'multiple') {
    let options = q.options.map((o) => ({ id: o.id, text: o.text }));
    if (shuffleOptions) options = shuffled(options, mulberry32((seed ^ hash32(q.id)) >>> 0));
    return { ...base, text: q.text, options };
  }
  if (q.type === 'truefalse') return { ...base, text: q.text };
  if (q.type === 'blank') {
    const { segments, blanks } = parseBlanks(q.text);
    return { ...base, segments, blankCount: blanks.length };
  }
  return { ...base, text: q.text };
}

/** Everything a person needs to take the test, for one seed. */
export function prepareAttempt(test, seed) {
  const questionIds = selectQuestionIds(test.questions, test.settings, seed);
  const byId = new Map(test.questions.map((q) => [q.id, q]));
  const questions = questionIds.map((id) =>
    toPublicQuestion(byId.get(id), { shuffleOptions: !!test.settings?.shuffleOptions, seed }),
  );
  return { questionIds, questions };
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

/** Keeps only well-formed answers for a question, so nothing odd is stored. */
export function sanitizeAnswer(q, answer) {
  switch (q.type) {
    case 'single': {
      const ids = q.options.map((o) => o.id);
      return typeof answer === 'string' && ids.includes(answer) ? answer : null;
    }
    case 'multiple': {
      if (!Array.isArray(answer)) return [];
      const ids = new Set(q.options.map((o) => o.id));
      return [...new Set(answer.filter((a) => typeof a === 'string' && ids.has(a)))];
    }
    case 'truefalse':
      return typeof answer === 'boolean' ? answer : null;
    case 'blank': {
      const count = parseBlanks(q.text).blanks.length;
      const given = Array.isArray(answer) ? answer : [];
      return Array.from({ length: count }, (_, i) =>
        typeof given[i] === 'string' ? given[i].trim().slice(0, LIMITS.blankAnswerMax) : '',
      );
    }
    default:
      return null;
  }
}

export function isAnswered(q, answer) {
  switch (q.type) {
    case 'single':
      return typeof answer === 'string' && answer !== '';
    case 'multiple':
      return Array.isArray(answer) && answer.length > 0;
    case 'truefalse':
      return typeof answer === 'boolean';
    case 'blank':
      return Array.isArray(answer) && answer.some((a) => String(a ?? '').trim() !== '');
    default:
      return false;
  }
}

/** Grades one question. All-or-nothing: checkboxes need every correct option, blanks need every blank. */
export function gradeQuestion(q, answer) {
  const points = pointsOf(q);
  switch (q.type) {
    case 'single': {
      const correct = typeof answer === 'string' && answer === q.correct;
      return { correct, earned: correct ? points : 0 };
    }
    case 'multiple': {
      const given = Array.isArray(answer) ? [...new Set(answer)] : [];
      const want = new Set(q.correct);
      const correct = given.length === want.size && given.every((a) => want.has(a));
      return { correct, earned: correct ? points : 0 };
    }
    case 'truefalse': {
      const correct = typeof answer === 'boolean' && answer === q.correct;
      return { correct, earned: correct ? points : 0 };
    }
    case 'blank': {
      const { blanks } = parseBlanks(q.text);
      const given = Array.isArray(answer) ? answer : [];
      const results = blanks.map((alternatives, i) => answerMatches(given[i], alternatives, !!q.caseSensitive));
      const correct = results.length > 0 && results.every(Boolean);
      return { correct, earned: correct ? points : 0, blanks: results };
    }
    default:
      return { correct: false, earned: 0 };
  }
}

/**
 * Grades an attempt.
 * @returns {{ answers, results, score, maxScore, percent }}
 */
export function gradeAttempt(test, questionIds, rawAnswers) {
  const byId = new Map(test.questions.map((q) => [q.id, q]));
  const answers = {};
  const results = {};
  let score = 0;
  let maxScore = 0;
  for (const id of questionIds) {
    const q = byId.get(id);
    if (!q) continue;
    const answer = sanitizeAnswer(q, rawAnswers?.[id]);
    const result = gradeQuestion(q, answer);
    answers[id] = answer;
    results[id] = result;
    score += result.earned;
    maxScore += pointsOf(q);
  }
  return { answers, results, score, maxScore, percent: toPercent(score, maxScore) };
}

export function toPercent(score, maxScore) {
  return maxScore > 0 ? Math.round((score / maxScore) * 1000) / 10 : 0;
}

export function isPassed(percent, passPercent) {
  return passPercent == null ? null : percent >= passPercent;
}

/** The correct answer in the same shape as a submitted answer (blanks: accepted alternatives per blank). */
export function correctAnswerOf(q) {
  switch (q.type) {
    case 'single':
      return q.correct;
    case 'multiple':
      return [...q.correct];
    case 'truefalse':
      return q.correct;
    case 'blank':
      return parseBlanks(q.text).blanks;
    default:
      return null;
  }
}

/**
 * Per-question review shown after submitting.
 * visibility: 'full' (answers + explanations) | 'marks' (right/wrong only) | 'score' (nothing).
 */
export function buildReview(test, questionIds, answers, results, visibility) {
  if (visibility === 'score') return [];
  const byId = new Map(test.questions.map((q) => [q.id, q]));
  return questionIds
    .filter((id) => byId.has(id))
    .map((id) => {
      const q = byId.get(id);
      const r = results?.[id] ?? { correct: false, earned: 0 };
      const answer = answers?.[id] ?? null;
      const item = {
        id,
        correct: !!r.correct,
        earned: r.earned ?? 0,
        points: pointsOf(q),
        answered: isAnswered(q, answer),
        answer,
      };
      if (Array.isArray(r.blanks)) item.blanks = r.blanks;
      if (visibility === 'full') {
        item.correctAnswer = correctAnswerOf(q);
        if (q.explanation) item.explanation = q.explanation;
      }
      return item;
    });
}

// ---------------------------------------------------------------------------
// Editing a test that already has responses
// ---------------------------------------------------------------------------

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Once people have answered, the answer key must not change (it would silently change their scores).
 * Wording, option text, explanations and question order may still change.
 * @returns {string[]} human-readable problems; empty means the edit is allowed.
 */
export function answerKeyChanges(oldQuestions, newQuestions) {
  const problems = [];
  const oldById = new Map(oldQuestions.map((q) => [q.id, q]));
  const newIds = newQuestions.map((q) => q.id);
  if (!sameSet(newIds, [...oldById.keys()])) {
    problems.push("Questions can't be added or removed after people have answered. Duplicate the test to make a new version.");
    return problems;
  }
  newQuestions.forEach((q, index) => {
    const old = oldById.get(q.id);
    const label = `Question ${index + 1}`;
    if (old.type !== q.type) {
      problems.push(`${label}: the question type can't change after people have answered.`);
      return;
    }
    if (pointsOf(old) !== pointsOf(q)) problems.push(`${label}: points can't change after people have answered.`);
    if (q.type === 'single' || q.type === 'multiple') {
      if (!sameSet(q.options.map((o) => o.id), old.options.map((o) => o.id))) {
        problems.push(`${label}: options can't be added or removed after people have answered.`);
      }
      const a = q.type === 'single' ? [q.correct] : q.correct;
      const b = old.type === 'single' ? [old.correct] : old.correct;
      if (!sameSet(a, b)) problems.push(`${label}: the correct answer can't change after people have answered.`);
    }
    if (q.type === 'truefalse' && q.correct !== old.correct) {
      problems.push(`${label}: the correct answer can't change after people have answered.`);
    }
    if (q.type === 'blank') {
      const a = parseBlanks(q.text).blanks;
      const b = parseBlanks(old.text).blanks;
      const same = a.length === b.length && a.every((alts, i) => sameSet(alts, b[i]));
      if (!same || !!q.caseSensitive !== !!old.caseSensitive) {
        problems.push(`${label}: the answers in [brackets] can't change after people have answered.`);
      }
    }
  });
  return problems;
}
