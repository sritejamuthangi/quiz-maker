import { describe, expect, it } from 'vitest';
import {
  answerKeyChanges,
  buildReview,
  gradeAttempt,
  gradeQuestion,
  prepareAttempt,
  sanitizeAnswer,
  selectQuestionIds,
  toPublicQuestion,
} from '../grading.js';
import { sampleQuestions, sampleTest } from './fixtures.js';

const [single, multiple, truefalse, blank] = sampleQuestions();

describe('gradeQuestion', () => {
  it('grades multiple choice', () => {
    expect(gradeQuestion(single, 'b')).toEqual({ correct: true, earned: 1 });
    expect(gradeQuestion(single, 'a')).toEqual({ correct: false, earned: 0 });
    expect(gradeQuestion(single, null)).toEqual({ correct: false, earned: 0 });
    expect(gradeQuestion(single, ['b'])).toEqual({ correct: false, earned: 0 });
  });

  it('grades checkboxes all-or-nothing', () => {
    expect(gradeQuestion(multiple, ['c', 'a'])).toEqual({ correct: true, earned: 2 });
    expect(gradeQuestion(multiple, ['a'])).toEqual({ correct: false, earned: 0 });
    expect(gradeQuestion(multiple, ['a', 'b', 'c'])).toEqual({ correct: false, earned: 0 });
    expect(gradeQuestion(multiple, 'a')).toEqual({ correct: false, earned: 0 });
  });

  it('grades true/false', () => {
    expect(gradeQuestion(truefalse, true).correct).toBe(true);
    expect(gradeQuestion(truefalse, false).correct).toBe(false);
    expect(gradeQuestion(truefalse, 'true').correct).toBe(false);
  });

  it('grades fill in the blank per blank', () => {
    expect(gradeQuestion(blank, ['paris', ' MADRID. '])).toEqual({ correct: true, earned: 1, blanks: [true, true] });
    expect(gradeQuestion(blank, ['Paris', 'Barcelona'])).toEqual({ correct: false, earned: 0, blanks: [true, false] });
    expect(gradeQuestion(blank, [])).toEqual({ correct: false, earned: 0, blanks: [false, false] });
    expect(gradeQuestion(blank, 'Paris')).toEqual({ correct: false, earned: 0, blanks: [false, false] });
  });
});

describe('sanitizeAnswer', () => {
  it('drops unknown option ids and wrong shapes', () => {
    expect(sanitizeAnswer(single, 'zzz')).toBeNull();
    expect(sanitizeAnswer(multiple, ['a', 'zzz', 'a', 5])).toEqual(['a']);
    expect(sanitizeAnswer(truefalse, 'yes')).toBeNull();
    expect(sanitizeAnswer(blank, ['Paris'])).toEqual(['Paris', '']);
    expect(sanitizeAnswer(blank, ['x'.repeat(500), 'y'])[0]).toHaveLength(100);
  });
});

describe('gradeAttempt', () => {
  it('totals points and percent, ignoring unknown questions', () => {
    const test = sampleTest();
    const ids = test.questions.map((q) => q.id);
    const graded = gradeAttempt(test, [...ids, 'missing'], {
      q1: 'b',
      q2: ['a'],
      q3: true,
      q4: ['Paris', 'Madrid'],
      bogus: 'x',
    });
    expect(graded.score).toBe(3);
    expect(graded.maxScore).toBe(5);
    expect(graded.percent).toBe(60);
    expect(Object.keys(graded.answers)).toEqual(['q1', 'q2', 'q3', 'q4']);
    expect(graded.results.q2).toEqual({ correct: false, earned: 0 });
  });

  it('only counts the questions that were served', () => {
    const test = sampleTest();
    const graded = gradeAttempt(test, ['q1', 'q3'], { q1: 'b', q3: true, q2: ['a', 'c'] });
    expect(graded.score).toBe(2);
    expect(graded.maxScore).toBe(2);
    expect(graded.percent).toBe(100);
  });
});

describe('toPublicQuestion / prepareAttempt', () => {
  it('never includes answers or explanations', () => {
    const test = sampleTest();
    const { questions } = prepareAttempt(test, 123);
    const json = JSON.stringify(questions);
    expect(json).not.toContain('correct');
    expect(json).not.toContain('explanation');
    expect(json).not.toContain('Paris');
    expect(json).not.toContain('Madrid');
    expect(json).not.toContain('Geography');
    const publicBlank = questions.find((q) => q.id === 'q4');
    expect(publicBlank.blankCount).toBe(2);
    expect(publicBlank.text).toBeUndefined();
  });

  it('shuffles options deterministically per seed', () => {
    const a = toPublicQuestion(single, { shuffleOptions: true, seed: 42 });
    const b = toPublicQuestion(single, { shuffleOptions: true, seed: 42 });
    expect(a.options).toEqual(b.options);
    expect(a.options.map((o) => o.id).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('selectQuestionIds', () => {
  const questions = Array.from({ length: 20 }, (_, i) => ({ id: `q${i}`, type: 'truefalse', text: 't', correct: true }));

  it('returns every question in order by default', () => {
    expect(selectQuestionIds(questions, {}, 1)).toEqual(questions.map((q) => q.id));
  });

  it('picks N random questions and keeps the author order', () => {
    const ids = selectQuestionIds(questions, { questionsPerAttempt: 5 }, 99);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    const positions = ids.map((id) => Number(id.slice(1)));
    expect(positions).toEqual([...positions].sort((x, y) => x - y));
  });

  it('is deterministic for a seed and varies between seeds', () => {
    const settings = { questionsPerAttempt: 5, shuffleQuestions: true };
    expect(selectQuestionIds(questions, settings, 7)).toEqual(selectQuestionIds(questions, settings, 7));
    const distinct = new Set(Array.from({ length: 10 }, (_, s) => selectQuestionIds(questions, settings, s).join()));
    expect(distinct.size).toBeGreaterThan(5);
  });

  it('shuffles the order when asked', () => {
    const ids = selectQuestionIds(questions, { shuffleQuestions: true }, 5);
    expect([...ids].sort()).toEqual(questions.map((q) => q.id).sort());
    expect(ids).not.toEqual(questions.map((q) => q.id));
  });
});

describe('buildReview', () => {
  const test = sampleTest();
  const ids = test.questions.map((q) => q.id);
  const graded = gradeAttempt(test, ids, { q1: 'a', q4: ['Paris', ''] });

  it('shows answers and explanations for "full"', () => {
    const review = buildReview(test, ids, graded.answers, graded.results, 'full');
    expect(review).toHaveLength(4);
    expect(review[0]).toMatchObject({ id: 'q1', correct: false, answered: true, correctAnswer: 'b', explanation: '2 + 2 = 4' });
    expect(review[2]).toMatchObject({ id: 'q3', answered: false, correct: false });
    expect(review[2].explanation).toBeUndefined(); // empty explanation is omitted
    expect(review[3]).toMatchObject({ blanks: [true, false], correctAnswer: [['Paris'], ['Madrid']] });
  });

  it('hides answers for "marks" and everything for "score"', () => {
    const marks = buildReview(test, ids, graded.answers, graded.results, 'marks');
    expect(marks[0].correctAnswer).toBeUndefined();
    expect(marks[0].explanation).toBeUndefined();
    expect(marks[0].correct).toBe(false);
    expect(buildReview(test, ids, graded.answers, graded.results, 'score')).toEqual([]);
  });
});

describe('answerKeyChanges', () => {
  it('allows wording, option text, explanation and order changes', () => {
    const before = sampleQuestions();
    const after = sampleQuestions().reverse();
    after[0].text = 'The capital of France is [Paris], and Spain’s is [Madrid].';
    after[3].text = 'What is two plus two?';
    after[3].options[0].text = 'three';
    after[3].explanation = 'Changed explanation';
    expect(answerKeyChanges(before, after)).toEqual([]);
  });

  it('rejects changes to the answer key', () => {
    const before = sampleQuestions();
    const changed = sampleQuestions();
    changed[0].correct = 'a';
    changed[1].points = 5;
    changed[2].correct = false;
    changed[3].text = 'The capital of France is [Lyon] and of Spain is [Madrid].';
    const problems = answerKeyChanges(before, changed);
    expect(problems).toHaveLength(4);
    expect(answerKeyChanges(before, before.slice(1))[0]).toMatch(/added or removed/);
    const newOption = sampleQuestions();
    newOption[0].options.push({ id: 'd', text: '6' });
    expect(answerKeyChanges(before, newOption)[0]).toMatch(/options can't be added/);
  });
});
