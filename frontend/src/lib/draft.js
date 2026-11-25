import { DEFAULT_EXPIRY_DAYS } from '@shared/limits.js';
import { testSchema } from '@shared/schema.js';
import { templateSettings } from '@shared/templates.js';
import { newId } from './ids.js';

export const newOption = () => ({ id: newId(6), text: '' });

export function newQuestion(type = 'single') {
  const base = { id: newId(), type, text: '', explanation: '', points: 1 };
  switch (type) {
    case 'multiple':
      return { ...base, options: [newOption(), newOption(), newOption(), newOption()], correct: [] };
    case 'truefalse':
      return { ...base, correct: null };
    case 'blank':
      return { ...base, caseSensitive: false };
    case 'single':
    default:
      return { ...base, type: 'single', options: [newOption(), newOption(), newOption(), newOption()], correct: '' };
  }
}

export function newDraft(templateId = 'blank') {
  return {
    title: '',
    description: '',
    settings: templateSettings(templateId),
    questions: [newQuestion('single')],
    expiryDays: DEFAULT_EXPIRY_DAYS,
  };
}

/** Converts a question to another type, keeping whatever still makes sense. */
export function changeType(question, type) {
  if (question.type === type) return question;
  const base = {
    id: question.id,
    type,
    text: question.text ?? '',
    explanation: question.explanation ?? '',
    points: question.points ?? 1,
  };
  const options = question.options?.length ? question.options : [newOption(), newOption(), newOption(), newOption()];
  switch (type) {
    case 'single':
      return { ...base, options, correct: question.type === 'multiple' ? (question.correct[0] ?? '') : '' };
    case 'multiple':
      return { ...base, options, correct: question.type === 'single' && question.correct ? [question.correct] : [] };
    case 'truefalse':
      return { ...base, correct: null };
    case 'blank':
      return { ...base, caseSensitive: false };
    default:
      return question;
  }
}

/** Copy of a question with fresh ids. */
export function duplicateQuestion(question) {
  const copy = structuredClone(question);
  copy.id = newId();
  if (copy.options) {
    const idMap = {};
    copy.options = copy.options.map((o) => {
      const id = newId(6);
      idMap[o.id] = id;
      return { ...o, id };
    });
    if (copy.type === 'single') copy.correct = idMap[copy.correct] ?? '';
    if (copy.type === 'multiple') copy.correct = copy.correct.map((c) => idMap[c]).filter(Boolean);
  }
  return copy;
}

/** A draft built from an existing test (for "Duplicate"). New ids so it is fully independent. */
export function draftFromTest(test, { copy = true } = {}) {
  return {
    title: copy ? `Copy of ${test.title}`.slice(0, 150) : test.title,
    description: test.description ?? '',
    settings: { ...templateSettings('blank'), ...test.settings },
    questions: test.questions.map((q) => (copy ? duplicateQuestion(q) : structuredClone(q))),
    expiryDays: DEFAULT_EXPIRY_DAYS,
  };
}

function cleanQuestion(q) {
  const out = { ...q, text: q.text ?? '', explanation: (q.explanation ?? '').trim() };
  if (q.type === 'single' || q.type === 'multiple') {
    let options = q.options.map((o) => ({ ...o, text: (o.text ?? '').trim() }));
    const filled = options.filter((o) => o.text !== '');
    // Empty extra options are simply ignored, as long as at least two are filled in.
    if (filled.length >= 2) options = filled;
    const ids = options.map((o) => o.id);
    out.options = options;
    if (q.type === 'single') out.correct = ids.includes(q.correct) ? q.correct : '';
    else out.correct = (q.correct ?? []).filter((id) => ids.includes(id));
  }
  return out;
}

/** The test as it will be sent to the server. */
export function toTestInput(draft) {
  return {
    title: draft.title ?? '',
    description: draft.description ?? '',
    settings: draft.settings,
    questions: (draft.questions ?? []).map(cleanQuestion),
  };
}

/**
 * Validates a draft with the same rules as the server and maps problems back to fields:
 * { title, description, settings: {field}, questions: { [questionId]: { text, correct, options: {[optionId]}, ... } }, general: [] }
 */
export function validateDraft(draft) {
  const input = toTestInput(draft);
  const result = testSchema.safeParse(input);
  const errors = { settings: {}, questions: {}, general: [] };
  if (result.success) return { valid: true, input: result.data, errors, count: 0 };

  for (const issue of result.error.issues) {
    const [head, ...rest] = issue.path;
    if (head === 'title' || head === 'description') {
      errors[head] ??= issue.message;
    } else if (head === 'settings') {
      errors.settings[rest[0] ?? 'general'] ??= issue.message;
    } else if (head === 'questions' && rest.length > 0) {
      const question = input.questions[rest[0]];
      if (!question) continue;
      const qErrors = (errors.questions[question.id] ??= { options: {} });
      const [, field, optionIndex] = rest;
      if (field === 'options' && typeof optionIndex === 'number') {
        const option = question.options?.[optionIndex];
        if (option) qErrors.options[option.id] ??= issue.message;
      } else if (field === 'options') {
        qErrors.optionsList ??= issue.message;
      } else if (field) {
        qErrors[field] ??= issue.message;
      } else {
        qErrors.general ??= issue.message;
      }
    } else {
      errors.general.push(issue.message);
    }
  }
  return { valid: false, input, errors, count: result.error.issues.length };
}
