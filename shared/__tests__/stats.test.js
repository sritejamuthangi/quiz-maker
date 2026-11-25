import { describe, expect, it } from 'vitest';
import { gradeAttempt } from '../grading.js';
import { computeStats } from '../stats.js';
import { sampleTest } from './fixtures.js';

describe('computeStats', () => {
  const test = sampleTest({ passPercent: 50 });
  const ids = test.questions.map((q) => q.id);
  const attempt = (answers, durationSeconds) => ({ ...gradeAttempt(test, ids, answers), questionIds: ids, durationSeconds });

  const attempts = [
    attempt({ q1: 'b', q2: ['a', 'c'], q3: true, q4: ['Paris', 'Madrid'] }, 60), // 100%
    attempt({ q1: 'a', q2: ['a'], q3: false, q4: ['London', 'madrid'] }, 120), // 0%
    attempt({ q1: 'b', q3: true, q4: ['london', ''] }, 90), // 40%
  ];

  it('summarises scores', () => {
    const { summary } = computeStats(test, attempts);
    expect(summary).toMatchObject({
      responses: 3,
      averagePercent: 46.7,
      medianPercent: 40,
      highestPercent: 100,
      lowestPercent: 0,
      averageDurationSeconds: 90,
      passPercent: 50,
      passedCount: 1,
    });
    expect(summary.histogram).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });

  it('breaks results down per question', () => {
    const { questions } = computeStats(test, attempts);
    const [q1, q2, q3, q4] = questions;
    expect(q1).toMatchObject({ served: 3, answered: 3, correct: 2, percentCorrect: 66.7, options: { a: 1, b: 2, c: 0 } });
    expect(q2).toMatchObject({ served: 3, answered: 2, correct: 1, options: { a: 2, b: 0, c: 1 } });
    expect(q3).toMatchObject({ trueCount: 2, falseCount: 1 });
    expect(q4.blanks[0]).toMatchObject({ correct: 1, topWrong: [{ answer: 'London', count: 2 }] });
    expect(q4.blanks[1]).toMatchObject({ correct: 2, topWrong: [] });
  });

  it('handles no responses', () => {
    const { summary, questions } = computeStats(test, []);
    expect(summary.averagePercent).toBeNull();
    expect(questions[0].percentCorrect).toBeNull();
  });
});
