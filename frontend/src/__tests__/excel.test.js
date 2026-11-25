import { describe, expect, it } from 'vitest';
import readExcelFile from 'read-excel-file/node';
import { templateWorkbook, resultsWorkbook } from '../lib/excel.js';
import { rowsToQuestions } from '../lib/importQuestions.js';
import { sampleTest } from '@shared/__tests__/fixtures.js';
import { gradeAttempt } from '@shared/grading.js';
import { computeStats } from '@shared/stats.js';

const readWorkbook = async (workbook) => readExcelFile(Buffer.from(await (await workbook.toBlob()).arrayBuffer()));

describe('real Excel files', () => {
  it('writes an import template that round-trips through the actual Excel reader', async () => {
    const sheets = await readWorkbook(templateWorkbook());
    expect(sheets.map((s) => s.sheet)).toEqual(['Questions']);
    const parsed = rowsToQuestions(sheets[0].data);
    expect(parsed.errors).toEqual([]);
    expect(parsed.questions.map((q) => q.type)).toEqual(['single', 'multiple', 'truefalse', 'blank', 'blank']);
    expect(parsed.questions[0].options.find((o) => o.id === parsed.questions[0].correct).text).toBe('Paris');
  });

  it('exports readable answers, scores, dates and all three sheets, including random selections', async () => {
    const test = sampleTest({ extraFieldLabel: 'Roll', passPercent: 50 });
    const ids = ['q1', 'q3', 'q4'];
    const graded = gradeAttempt(test, ids, { q1: 'b', q3: false, q4: ['Paris', 'Madrid'] });
    const response = {
      ...graded, id: 1, name: '=1+1', extra: '001', questionIds: ids,
      passed: true, durationSeconds: 65, tabLeaves: 2, overtime: false,
      submittedAt: '2026-11-24T12:00:00.000Z',
    };
    const sheets = await readWorkbook(resultsWorkbook({ test, responses: [response], stats: computeStats(test, [response]) }));
    expect(sheets.map((s) => s.sheet)).toEqual(['Responses', 'Questions', 'Summary']);
    const [head, row] = sheets[0].data;
    const byHeader = Object.fromEntries(head.map((label, i) => [label, row[i]]));
    expect(byHeader).toMatchObject({ Name: '=1+1', Roll: '001', Score: 2, 'Out of': 3, Percent: 0.667, Result: 'Pass', 'Time taken': '1:05', 'Left the screen': 2 });
    expect(byHeader.Submitted).toBeInstanceOf(Date);
    expect(row.slice(-4)).toEqual(['✓ 4', 'not asked', '✗ False', '✓ Paris | Madrid']);
    expect(sheets[1].data[4][1]).not.toContain('[Paris]');
    expect(sheets[1].data[4][3]).toBe('Paris | Madrid');
    expect(sheets[1].data[1][8]).toBe('2 + 2 = 4');
    expect(sheets[2].data).toContainEqual(['Responses', 1]);
  });
});
