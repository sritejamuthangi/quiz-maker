// Size limits shared by the browser (for instant feedback) and the API (authoritative).
// Changing a number here changes it everywhere.

export const LIMITS = Object.freeze({
  titleMax: 150,
  descriptionMax: 2000,
  questionsMax: 100,
  questionTextMax: 1000,
  optionsMin: 2,
  optionsMax: 6,
  optionTextMax: 300,
  explanationMax: 1000,
  pointsMin: 1,
  pointsMax: 100,
  blanksMax: 10,
  blankAlternativesMax: 10,
  blankAnswerMax: 100,
  nameMax: 80,
  extraMax: 120,
  extraLabelMax: 40,
  timeLimitMaxMinutes: 600,
  idMax: 16,
});

export const QUESTION_TYPES = Object.freeze(['single', 'multiple', 'truefalse', 'blank']);

export const QUESTION_TYPE_LABELS = Object.freeze({
  single: 'Multiple choice',
  multiple: 'Checkboxes',
  truefalse: 'True / False',
  blank: 'Fill in the blank',
});

/** What a test-taker sees after submitting. */
export const RESULTS_VISIBILITY = Object.freeze(['full', 'marks', 'score']);

export const RESULTS_VISIBILITY_LABELS = Object.freeze({
  full: 'Score, correct answers and explanations',
  marks: 'Score and which questions were right or wrong',
  score: 'Score only',
});

/** Tests (and their results) are deleted automatically after one of these periods. */
export const EXPIRY_DAYS = Object.freeze([7, 30, 90]);
export const DEFAULT_EXPIRY_DAYS = 30;

/** Submissions this many seconds past the time limit are accepted but flagged "overtime". */
export const OVERTIME_GRACE_SECONDS = 90;
