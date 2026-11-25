import { describe, expect, it } from 'vitest';
import { createTestSchema, formatIssues, submitSchema, testSchema } from '../schema.js';
import { sampleQuestions } from './fixtures.js';

const validBody = () => ({ title: '  My quiz  ', questions: sampleQuestions() });

const messages = (result) => formatIssues(result.error).map((i) => `${i.path}: ${i.message}`);

describe('createTestSchema', () => {
  it('accepts a valid test and fills in defaults', () => {
    const body = validBody();
    delete body.questions[0].points;
    delete body.questions[0].explanation;
    const result = createTestSchema.safeParse(body);
    expect(result.success).toBe(true);
    expect(result.data.title).toBe('My quiz');
    expect(result.data.expiryDays).toBe(30);
    expect(result.data.settings).toMatchObject({ requireName: true, resultsVisibility: 'full', timeLimitMinutes: null });
    expect(result.data.questions[0]).toMatchObject({ points: 1, explanation: '' });
  });

  it('requires a title and at least one question', () => {
    const result = createTestSchema.safeParse({ title: '', questions: [] });
    expect(result.success).toBe(false);
    expect(messages(result)).toEqual(expect.arrayContaining(['title: Title is required', 'questions: Add at least one question']));
  });

  it('explains a missing correct answer', () => {
    const body = validBody();
    body.questions[0].correct = '';
    body.questions[2].correct = undefined;
    const result = createTestSchema.safeParse(body);
    expect(messages(result)).toEqual(
      expect.arrayContaining([
        'questions.0.correct: Mark the correct answer',
        'questions.2.correct: Choose whether the statement is true or false',
      ]),
    );
  });

  it('rejects answers that are not options and duplicate options', () => {
    const body = validBody();
    body.questions[0].correct = 'zzz';
    body.questions[1].options[1].text = '2';
    const result = createTestSchema.safeParse(body);
    expect(messages(result)).toEqual(
      expect.arrayContaining(['questions.0.correct: Mark the correct answer', 'questions.1.options.1.text: Two options have the same text']),
    );
  });

  it('requires brackets in fill-in-the-blank questions', () => {
    const body = validBody();
    body.questions[3].text = 'No brackets here';
    expect(messages(createTestSchema.safeParse(body))[0]).toMatch(/square brackets/);
  });

  it('enforces size limits', () => {
    const many = Array.from({ length: 101 }, (_, i) => ({ id: `q${i}`, type: 'truefalse', text: 'x', correct: true }));
    expect(createTestSchema.safeParse({ title: 'x', questions: many }).success).toBe(false);
    expect(createTestSchema.safeParse({ ...validBody(), title: 'x'.repeat(151) }).success).toBe(false);
    const longOption = validBody();
    longOption.questions[0].options[0].text = 'x'.repeat(301);
    expect(createTestSchema.safeParse(longOption).success).toBe(false);
    expect(createTestSchema.safeParse({ ...validBody(), expiryDays: 365 }).success).toBe(false);
  });

  it("doesn't allow more random questions than exist", () => {
    const result = testSchema.safeParse({ ...validBody(), settings: { questionsPerAttempt: 10 } });
    expect(messages(result)[0]).toMatch(/can't pick 10 random questions from 4/);
  });
});

describe('submitSchema', () => {
  it('accepts a typical submission', () => {
    const r = submitSchema.safeParse({
      token: 'x'.repeat(20),
      name: ' Asha ',
      answers: { q1: 'b', q2: ['a', 'c'], q3: true, q4: ['Paris', 'Madrid'], q5: null },
    });
    expect(r.success).toBe(true);
    expect(r.data.name).toBe('Asha');
    expect(r.data.tabLeaves).toBe(0);
  });

  it('rejects oversized input', () => {
    const answers = Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`q${i}`, true]));
    expect(submitSchema.safeParse({ token: 'x'.repeat(20), answers }).success).toBe(false);
    expect(submitSchema.safeParse({ token: 'x'.repeat(20), name: 'x'.repeat(81) }).success).toBe(false);
  });
});
