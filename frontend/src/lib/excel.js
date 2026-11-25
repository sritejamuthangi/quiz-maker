// Builds .xlsx files in the browser, so the server never does this work.
import writeExcelFile from 'write-excel-file/browser';
import { parseBlanks, textWithBlanks } from '@shared/blanks.js';
import { QUESTION_TYPE_LABELS } from '@shared/limits.js';
import { TEMPLATE_HEADERS, TEMPLATE_ROWS } from './importQuestions.js';
import { formatDuration } from './format.js';

const HEADER = { fontWeight: 'bold', backgroundColor: '#0b5a72', textColor: '#ffffff', wrap: true, alignVertical: 'center' };
const GOOD = '#e6f4ea';
const BAD = '#fdecea';
const MUTED = '#f1f3f4';

const header = (labels) => labels.map((value) => ({ value, ...HEADER }));
const widths = (list) => list.map((width) => ({ width }));

function safeFileName(text) {
  const cleaned = String(text || 'Quiz').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, 80) || 'Quiz';
}

function optionText(question, optionId) {
  return question.options?.find((o) => o.id === optionId)?.text ?? '';
}

/** A person's answer as readable text. */
export function answerToText(question, answer) {
  switch (question.type) {
    case 'single':
      return answer ? optionText(question, answer) : '';
    case 'multiple':
      return Array.isArray(answer) ? answer.map((id) => optionText(question, id)).join('; ') : '';
    case 'truefalse':
      return answer === true ? 'True' : answer === false ? 'False' : '';
    case 'blank':
      return Array.isArray(answer) && answer.some((a) => a) ? answer.map((a) => a || '—').join(' | ') : '';
    default:
      return '';
  }
}

export function correctAnswerToText(question) {
  switch (question.type) {
    case 'single':
      return optionText(question, question.correct);
    case 'multiple':
      return question.correct.map((id) => optionText(question, id)).join('; ');
    case 'truefalse':
      return question.correct ? 'True' : 'False';
    case 'blank':
      return parseBlanks(question.text)
        .blanks.map((alternatives) => alternatives.join(' / '))
        .join(' | ');
    default:
      return '';
  }
}

export const questionDisplayText = (question) =>
  question.type === 'blank' ? textWithBlanks(question.text) : question.text;

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Builds the real workbook; callers can download it or obtain a Blob. */
export function resultsWorkbook({ test, responses, stats }) {
  const { questions, settings } = test;
  const extraLabel = settings.extraFieldLabel;
  const hasPass = settings.passPercent != null;

  // Sheet 1: one row per person, one column per question.
  const columnsLeft = ['#', 'Name', ...(extraLabel ? [extraLabel] : []), 'Score', 'Out of', 'Percent'];
  if (hasPass) columnsLeft.push('Result');
  columnsLeft.push('Time taken', 'Left the screen', 'Overtime', 'Submitted');
  const questionHeaders = questions.map((q, i) => `Q${i + 1}. ${truncate(questionDisplayText(q), 60)}`);

  const responseRows = responses.map((r, index) => {
    const row = [
      index + 1,
      r.name || '(no name)',
      ...(extraLabel ? [r.extra || ''] : []),
      r.score,
      r.maxScore,
      { value: r.percent / 100, format: '0.0%' },
    ];
    if (hasPass) {
      row.push({ value: r.passed ? 'Pass' : 'Fail', backgroundColor: r.passed ? GOOD : BAD });
    }
    row.push(formatDuration(r.durationSeconds), r.tabLeaves, r.overtime ? 'Yes' : '', {
      value: new Date(r.submittedAt),
      type: Date,
      format: 'yyyy-mm-dd hh:mm',
    });
    for (const q of questions) {
      if (!r.questionIds.includes(q.id)) {
        row.push({ value: 'not asked', backgroundColor: MUTED, textColor: '#777777' });
        continue;
      }
      const correct = Boolean(r.results?.[q.id]?.correct);
      const text = answerToText(q, r.answers?.[q.id]) || '(no answer)';
      row.push({ value: `${correct ? '✓' : '✗'} ${text}`, backgroundColor: correct ? GOOD : BAD });
    }
    return row;
  });

  const responsesSheet = {
    sheet: 'Responses',
    data: [header([...columnsLeft, ...questionHeaders]), ...responseRows],
    columns: widths([5, 24, ...(extraLabel ? [16] : []), 8, 8, 9, ...(hasPass ? [8] : []), 11, 10, 10, 17, ...questions.map(() => 28)]),
    stickyRowsCount: 1,
    stickyColumnsCount: 2,
  };

  // Sheet 2: the questions with the answer key and how people did.
  const questionStats = new Map(stats.questions.map((s) => [s.id, s]));
  const questionsSheet = {
    sheet: 'Questions',
    data: [
      header(['#', 'Question', 'Type', 'Correct answer', 'Points', 'Asked', 'Got it right', '% correct', 'Explanation']),
      ...questions.map((q, i) => {
        const s = questionStats.get(q.id);
        return [
          i + 1,
          { value: questionDisplayText(q), wrap: true },
          QUESTION_TYPE_LABELS[q.type],
          { value: correctAnswerToText(q), wrap: true },
          q.points ?? 1,
          s?.served ?? 0,
          s?.correct ?? 0,
          s?.percentCorrect == null ? '—' : { value: s.percentCorrect / 100, format: '0.0%' },
          { value: q.explanation || '', wrap: true },
        ];
      }),
    ],
    columns: widths([5, 60, 16, 30, 8, 8, 12, 10, 50]),
    stickyRowsCount: 1,
  };

  // Sheet 3: summary.
  const s = stats.summary;
  const pct = (v) => (v == null ? '—' : { value: v / 100, format: '0.0%' });
  const summaryRows = [
    ['Test', test.title],
    ['Downloaded', { value: new Date(), type: Date, format: 'yyyy-mm-dd hh:mm' }],
    ['Responses', s.responses],
    ['Average score', pct(s.averagePercent)],
    ['Median score', pct(s.medianPercent)],
    ['Highest score', pct(s.highestPercent)],
    ['Lowest score', pct(s.lowestPercent)],
    ['Average time', formatDuration(s.averageDurationSeconds)],
  ];
  if (hasPass) {
    summaryRows.push(['Pass mark', `${settings.passPercent}%`], ['Passed', `${s.passedCount} of ${s.responses}`]);
  }
  const summarySheet = {
    sheet: 'Summary',
    data: summaryRows.map(([label, value]) => [{ value: label, fontWeight: 'bold' }, value]),
    columns: widths([18, 50]),
  };

  return writeExcelFile([responsesSheet, questionsSheet, summarySheet], { fontFamily: 'Calibri', fontSize: 11 });
}

export async function exportResultsToExcel(data) {
  await resultsWorkbook(data).toFile(`${safeFileName(data.test.title)} - results.xlsx`);
}

/** Downloads the question import template (.xlsx). */
export function templateWorkbook() {
  const data = [header(TEMPLATE_HEADERS), ...TEMPLATE_ROWS.map((row) => row.map((v) => (v === '' ? null : v)))];
  return writeExcelFile(data, {
    sheet: 'Questions',
    columns: widths([16, 50, 16, 16, 16, 16, 16, 16, 10, 50, 8]),
    stickyRowsCount: 1,
  });
}

export async function downloadTemplateXlsx() {
  await templateWorkbook().toFile('quiz-questions-template.xlsx');
}

/** Downloads the question import template (.csv, UTF-8 with BOM so Excel shows accents correctly). */
export function downloadTemplateCsv() {
  const escape = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS].map((row) => row.map(escape).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'quiz-questions-template.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
