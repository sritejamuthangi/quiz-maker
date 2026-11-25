import { z } from 'zod';
import { LIMITS, EXPIRY_DAYS, DEFAULT_EXPIRY_DAYS, RESULTS_VISIBILITY } from './limits.js';
import { parseBlanks } from './blanks.js';

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

const idSchema = z
  .string({ error: 'Missing id' })
  .regex(new RegExp(`^[A-Za-z0-9_-]{1,${LIMITS.idMax}}$`), 'Invalid id')
  .refine((id) => !['__proto__', 'prototype', 'constructor'].includes(id), 'Reserved id');

const requiredText = (max, label) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} is too long (max ${max} characters)`);

const optionalText = (max, label) =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long (max ${max} characters)`)
    .default('');

const pointsSchema = z
  .number({ error: 'Points must be a number' })
  .int('Points must be a whole number')
  .min(LIMITS.pointsMin, `Points must be at least ${LIMITS.pointsMin}`)
  .max(LIMITS.pointsMax, `Points can be at most ${LIMITS.pointsMax}`)
  .default(1);

const optionSchema = z.object({
  id: idSchema,
  text: requiredText(LIMITS.optionTextMax, 'Option text'),
});

const optionsSchema = z
  .array(optionSchema)
  .min(LIMITS.optionsMin, `Add at least ${LIMITS.optionsMin} options`)
  .max(LIMITS.optionsMax, `A question can have at most ${LIMITS.optionsMax} options`);

const questionBase = {
  id: idSchema,
  text: requiredText(LIMITS.questionTextMax, 'Question'),
  explanation: optionalText(LIMITS.explanationMax, 'Explanation'),
  points: pointsSchema,
};

const singleQuestion = z.object({
  ...questionBase,
  type: z.literal('single'),
  options: optionsSchema,
  correct: z.string({ error: 'Mark the correct answer' }).min(1, 'Mark the correct answer').max(LIMITS.idMax),
});

const multipleQuestion = z.object({
  ...questionBase,
  type: z.literal('multiple'),
  options: optionsSchema,
  correct: z
    .array(z.string().max(LIMITS.idMax), { error: 'Mark the correct answers' })
    .min(1, 'Mark at least one correct answer')
    .max(LIMITS.optionsMax),
});

const trueFalseQuestion = z.object({
  ...questionBase,
  type: z.literal('truefalse'),
  correct: z.boolean({ error: 'Choose whether the statement is true or false' }),
});

const blankQuestion = z.object({
  ...questionBase,
  type: z.literal('blank'),
  caseSensitive: z.boolean().default(false),
});

export const questionSchema = z
  .discriminatedUnion('type', [singleQuestion, multipleQuestion, trueFalseQuestion, blankQuestion], {
    error: 'Choose a question type',
  })
  .superRefine((q, ctx) => {
    if (q.type === 'single' || q.type === 'multiple') {
      const ids = q.options.map((o) => o.id);
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({ code: 'custom', path: ['options'], message: 'Option ids must be unique' });
      }
      const texts = q.options.map((o) => o.text.toLowerCase());
      texts.forEach((t, i) => {
        if (texts.indexOf(t) !== i) {
          ctx.addIssue({ code: 'custom', path: ['options', i, 'text'], message: 'Two options have the same text' });
        }
      });
      const correct = q.type === 'single' ? [q.correct] : q.correct;
      if (correct.some((c) => !ids.includes(c))) {
        ctx.addIssue({ code: 'custom', path: ['correct'], message: 'Mark the correct answer' });
      }
      if (new Set(correct).size !== correct.length) {
        ctx.addIssue({ code: 'custom', path: ['correct'], message: 'A correct answer is listed twice' });
      }
    }
    if (q.type === 'blank') {
      const parsed = parseBlanks(q.text);
      if (parsed.error) {
        ctx.addIssue({ code: 'custom', path: ['text'], message: parsed.error });
      } else if (parsed.blanks.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['text'],
          message: 'Put at least one answer in [square brackets], like: The capital of France is [Paris].',
        });
      }
    }
  });

const isValidDate = (s) => !Number.isNaN(Date.parse(s));

export const settingsSchema = z.object({
  timeLimitMinutes: z
    .number()
    .int()
    .min(1, 'Time limit must be at least 1 minute')
    .max(LIMITS.timeLimitMaxMinutes, `Time limit can be at most ${LIMITS.timeLimitMaxMinutes} minutes`)
    .nullable()
    .default(null),
  requireName: z.boolean().default(true),
  extraFieldLabel: optionalText(LIMITS.extraLabelMax, 'Extra field label'),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  questionsPerAttempt: z
    .number()
    .int()
    .min(1, 'Pick at least 1 question per person')
    .max(LIMITS.questionsMax)
    .nullable()
    .default(null),
  resultsVisibility: z.enum(RESULTS_VISIBILITY).default('full'),
  passPercent: z.number().int().min(1, 'Pass mark must be 1–100%').max(100, 'Pass mark must be 1–100%').nullable().default(null),
  allowRetakes: z.boolean().default(false),
  closesAt: z.string().max(40).refine(isValidDate, 'Invalid date').nullable().default(null),
});

const questionsSchema = z
  .array(questionSchema)
  .min(1, 'Add at least one question')
  .max(LIMITS.questionsMax, `A test can have at most ${LIMITS.questionsMax} questions`);

const titleSchema = requiredText(LIMITS.titleMax, 'Title');
const descriptionSchema = optionalText(LIMITS.descriptionMax, 'Description');

function checkTest(t, ctx) {
  const ids = t.questions.map((q) => q.id);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: 'custom', path: ['questions'], message: 'Question ids must be unique' });
  }
  const n = t.settings.questionsPerAttempt;
  if (n != null && n > t.questions.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['settings', 'questionsPerAttempt'],
      message: `You can't pick ${n} random questions from ${t.questions.length}. Add more questions or lower the number.`,
    });
  }
}

/** A complete test (title, settings and questions). */
export const testSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema,
    settings: settingsSchema.prefault({}),
    questions: questionsSchema,
  })
  .superRefine(checkTest);

const expiryDaysSchema = z.union(
  EXPIRY_DAYS.map((d) => z.literal(d)),
  { error: `Choose ${EXPIRY_DAYS.join(', ')} days` },
);

/** Body of POST /api/tests */
export const createTestSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema,
    settings: settingsSchema.prefault({}),
    questions: questionsSchema,
    expiryDays: expiryDaysSchema.default(DEFAULT_EXPIRY_DAYS),
  })
  .superRefine(checkTest);

/** Body of PATCH /api/manage/:publicId. Settings are merged with the existing ones on the server. */
export const updateTestSchema = z.object({
  title: titleSchema.optional(),
  description: z.string().trim().max(LIMITS.descriptionMax).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  questions: z.array(z.unknown()).max(LIMITS.questionsMax).optional(),
  isOpen: z.boolean().optional(),
  extendDays: expiryDaysSchema.optional(),
});

const answerValueSchema = z.union([
  z.string().max(LIMITS.idMax),
  z.boolean(),
  z.array(z.string().max(LIMITS.blankAnswerMax)).max(Math.max(LIMITS.optionsMax, LIMITS.blanksMax)),
  z.null(),
]);

/** Body of POST /api/tests/:publicId/submit */
export const submitSchema = z.object({
  token: z.string().min(10).max(2000),
  name: z.string().trim().max(LIMITS.nameMax, `Name is too long (max ${LIMITS.nameMax} characters)`).default(''),
  extra: z.string().trim().max(LIMITS.extraMax, `This field is too long (max ${LIMITS.extraMax} characters)`).default(''),
  answers: z
    .record(idSchema, answerValueSchema)
    .refine((a) => Object.keys(a).length <= LIMITS.questionsMax, 'Too many answers')
    .default({}),
  tabLeaves: z.number().int().min(0).max(100000).default(0),
});

/** Flattens zod issues into [{ path: 'questions.0.text', message }]. */
export function formatIssues(error) {
  return (error?.issues ?? []).map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}
