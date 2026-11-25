import { describe, expect, it } from 'vitest';
import { changeType, duplicateQuestion, newDraft, newQuestion, toTestInput, validateDraft } from '../lib/draft.js';

describe('draft helpers', () => {
  it('starts from a template', () => {
    const draft = newDraft('exam');
    expect(draft.settings).toMatchObject({ timeLimitMinutes: 30, resultsVisibility: 'marks' });
    expect(draft.questions).toHaveLength(1);
    expect(draft.expiryDays).toBe(30);
  });

  it('drops empty extra options and keeps the answer', () => {
    const q = newQuestion('single');
    q.text = 'Pick B';
    q.options[0].text = 'A';
    q.options[1].text = ' B ';
    q.correct = q.options[1].id;
    const input = toTestInput({ ...newDraft(), title: 'T', questions: [q] });
    expect(input.questions[0].options.map((o) => o.text)).toEqual(['A', 'B']);
    expect(input.questions[0].correct).toBe(q.options[1].id);
  });

  it('maps validation problems back to the right question and option', () => {
    const q1 = newQuestion('single');
    q1.text = 'Duplicate options';
    // The empty option in the middle is dropped before validation, so indexes shift:
    // errors must still land on the right option (matched by id, not position).
    q1.options[0].text = 'Same';
    q1.options[1].text = '';
    q1.options[2].text = 'Other';
    q1.options[3].text = 'Same';
    q1.correct = q1.options[0].id;
    const q2 = newQuestion('blank');
    q2.text = 'No brackets';
    const result = validateDraft({ ...newDraft(), title: '', questions: [q1, q2] });

    expect(result.valid).toBe(false);
    expect(result.errors.title).toBe('Title is required');
    expect(result.errors.questions[q1.id].options).toEqual({ [q1.options[3].id]: 'Two options have the same text' });
    expect(result.errors.questions[q2.id].text).toMatch(/square brackets/);
  });

  it('converts between question types and duplicates with new ids', () => {
    const single = newQuestion('single');
    single.correct = single.options[2].id;
    const multiple = changeType(single, 'multiple');
    expect(multiple.correct).toEqual([single.options[2].id]);
    expect(changeType(multiple, 'single').correct).toBe(single.options[2].id);
    expect(changeType(single, 'truefalse')).toMatchObject({ type: 'truefalse', correct: null });

    const copy = duplicateQuestion(single);
    expect(copy.id).not.toBe(single.id);
    expect(copy.options.map((o) => o.id)).not.toEqual(single.options.map((o) => o.id));
    expect(copy.correct).toBe(copy.options[2].id);
  });
});
