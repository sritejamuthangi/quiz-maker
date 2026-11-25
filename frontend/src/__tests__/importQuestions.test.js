import { describe, expect, it } from 'vitest';
import { TEMPLATE_HEADERS, TEMPLATE_ROWS, readQuestionFile, rowsToQuestions } from '../lib/importQuestions.js';

describe('rowsToQuestions', () => {
  it('reads every example row of the template', () => {
    const { questions, errors } = rowsToQuestions([TEMPLATE_HEADERS, ...TEMPLATE_ROWS]);
    expect(errors).toEqual([]);
    expect(questions.map((q) => q.type)).toEqual(['single', 'multiple', 'truefalse', 'blank', 'blank']);

    const [single, multiple, tf, blank, brackets] = questions;
    expect(single.options.map((o) => o.text)).toEqual(['Berlin', 'Paris', 'Madrid', 'Rome']);
    expect(single.correct).toBe(single.options[1].id);
    expect(multiple.correct).toEqual([multiple.options[0].id, multiple.options[2].id]);
    expect(multiple.points).toBe(2);
    expect(tf.correct).toBe(true);
    expect(blank.text).toBe('Water is made of hydrogen and [oxygen].');
    expect(brackets.text).toContain('[Au]');
  });

  it('accepts headers in any order with alternative names, without a type column', () => {
    const rows = [
      ['Answer', 'Question text', 'A', 'B', 'C', 'Marks'],
      ['c', 'Largest planet?', 'Mars', 'Venus', 'Jupiter', 3],
      ['A; C', 'Pick the even numbers', '2', '3', '4', ''],
    ];
    const { questions, errors } = rowsToQuestions(rows);
    expect(errors).toEqual([]);
    expect(questions[0]).toMatchObject({ type: 'single', points: 3 });
    expect(questions[0].correct).toBe(questions[0].options[2].id);
    expect(questions[1].type).toBe('multiple');
    expect(questions[1].correct).toHaveLength(2);
  });

  it('matches answers by option text and handles several blanks', () => {
    const { questions, errors } = rowsToQuestions([
      TEMPLATE_HEADERS,
      ['mcq', 'Capital of Japan?', 'Kyoto', 'Tokyo', '', '', '', '', 'tokyo', '', ''],
      ['fill', '___ and ___ are primary colours.', '', '', '', '', '', '', 'red|blue; yellow', '', ''],
      ['', 'Is water wet?', '', '', '', '', '', '', 'yes', '', ''],
    ]);
    expect(errors).toEqual([]);
    expect(questions[0].correct).toBe(questions[0].options[1].id);
    expect(questions[1].text).toBe('[red|blue] and [yellow] are primary colours.');
    expect(questions[2]).toMatchObject({ type: 'truefalse', correct: true });
  });

  it('reads a UTF-8 BOM CSV with quoted commas, blank lines and Windows line endings', async () => {
    const csv = [
      `\uFEFF${TEMPLATE_HEADERS.join(',')}`,
      '"Multiple choice","Capital of France, officially?","Berlin","Paris","Madrid","Rome","","","B","Chosen in 987, it is on the Seine.",2',
      '',
      '"True/False","The Earth orbits the Sun.","","","","","","","True","",1',
    ].join('\r\n');
    const rows = await readQuestionFile(new File([csv], 'questions.csv', { type: 'text/csv' }));
    const { questions, errors } = rowsToQuestions(rows);
    expect(errors).toEqual([]);
    expect(questions).toHaveLength(2);
    expect(questions[0]).toMatchObject({ type: 'single', text: 'Capital of France, officially?', points: 2 });
    expect(questions[0].explanation).toBe('Chosen in 987, it is on the Seine.');
    expect(questions[1]).toMatchObject({ type: 'truefalse', correct: true });
  });

  it('rejects an unclosed CSV quote and unsupported file types with clear messages', async () => {
    await expect(
      readQuestionFile(new File(['Type,Question\r\nMultiple choice,"unclosed'], 'broken.csv', { type: 'text/csv' })),
    ).rejects.toThrow(/quote/i);
    await expect(readQuestionFile(new File(['anything'], 'old.xls'))).rejects.toThrow(/xlsx/);
  });

  it('reports problems per row and skips empty rows', () => {
    const { questions, errors } = rowsToQuestions([
      TEMPLATE_HEADERS,
      ['Multiple choice', 'No answer given', 'x', 'y', '', '', '', '', '', '', ''],
      [],
      ['Multiple choice', 'Bad letter', 'x', 'y', '', '', '', '', 'F', '', ''],
      ['True/False', 'Maybe?', '', '', '', '', '', '', 'perhaps', '', ''],
      ['Fill in the blank', 'Two ___ but ___ one answer', '', '', '', '', '', '', 'a', '', ''],
      ['Essay', 'Unknown type', '', '', '', '', '', '', '', '', ''],
      ['Multiple choice', 'Too many points', 'x', 'y', '', '', '', '', 'A', '', 500],
    ]);
    expect(questions).toEqual([]);
    expect(errors.map((e) => e.row)).toEqual([2, 4, 5, 6, 7, 8]);
    expect(errors[0].message).toMatch(/Correct column is empty/);
    expect(errors[1].message).toMatch(/doesn't match/);
    expect(errors[2].message).toMatch(/True or False/);
    expect(errors[3].message).toMatch(/2 blank/);
    expect(errors[4].message).toMatch(/Unknown type/);
    expect(errors[5].message).toMatch(/Points/);
  });
});
