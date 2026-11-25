import { buildReview, isPassed } from '../../shared/grading.js';

export function isExpired(test, now = Date.now()) {
  return new Date(test.expiresAt).getTime() <= now;
}

/** open | closed | full | expired */
export function testStatus(test, limits, now = Date.now()) {
  if (isExpired(test, now)) return 'expired';
  if (!test.isOpen) return 'closed';
  const closesAt = test.settings?.closesAt;
  if (closesAt && Date.parse(closesAt) <= now) return 'closed';
  if (test.responseCount >= limits.responsesPerTest) return 'full';
  return 'open';
}

/** Only the settings a test-taker needs to see. */
export function takerSettings(settings) {
  return {
    timeLimitMinutes: settings.timeLimitMinutes ?? null,
    requireName: settings.requireName !== false,
    extraFieldLabel: settings.extraFieldLabel ?? '',
    resultsVisibility: settings.resultsVisibility ?? 'full',
    passPercent: settings.passPercent ?? null,
    allowRetakes: !!settings.allowRetakes,
    closesAt: settings.closesAt ?? null,
  };
}

/** What anyone with the share link sees before starting (no questions). */
export function publicTestMeta(test, limits) {
  const { questions, settings } = test;
  const total = questions.length;
  const perAttempt = settings.questionsPerAttempt;
  const count = perAttempt && perAttempt < total ? perAttempt : total;
  const points = questions.map((q) => q.points ?? 1);
  const samePoints = points.every((p) => p === points[0]);
  let totalPoints = null;
  if (count === total) totalPoints = points.reduce((a, b) => a + b, 0);
  else if (samePoints) totalPoints = count * points[0];
  return {
    publicId: test.publicId,
    title: test.title,
    description: test.description,
    questionCount: count,
    totalPoints,
    settings: takerSettings(settings),
    status: testStatus(test, limits),
  };
}

/** The result a test-taker sees after submitting, respecting the test's visibility setting. */
export function attemptResult(test, attempt) {
  const settings = test.settings;
  const visibility = settings.resultsVisibility ?? 'full';
  const passPercent = settings.passPercent ?? null;
  return {
    score: attempt.score,
    maxScore: attempt.maxScore,
    percent: attempt.percent,
    passPercent,
    passed: isPassed(attempt.percent, passPercent),
    durationSeconds: attempt.durationSeconds,
    overtime: attempt.overtime,
    visibility,
    review: buildReview(test, attempt.questionIds, attempt.answers, attempt.results, visibility),
    submittedAt: attempt.createdAt,
  };
}

/** One row in the creator's response list. */
export function responseSummary(attempt, passPercent) {
  return {
    id: attempt.id,
    name: attempt.name,
    extra: attempt.extra,
    score: attempt.score,
    maxScore: attempt.maxScore,
    percent: attempt.percent,
    passed: isPassed(attempt.percent, passPercent ?? null),
    durationSeconds: attempt.durationSeconds,
    tabLeaves: attempt.tabLeaves,
    overtime: attempt.overtime,
    submittedAt: attempt.createdAt,
  };
}

/** The full test as the creator sees it (with answers). */
export function managedTest(test, limits) {
  return {
    publicId: test.publicId,
    title: test.title,
    description: test.description,
    questions: test.questions,
    settings: test.settings,
    isOpen: test.isOpen,
    responseCount: test.responseCount,
    expiresAt: test.expiresAt,
    createdAt: test.createdAt,
    updatedAt: test.updatedAt,
    status: testStatus(test, limits),
    locked: test.responseCount > 0,
    limits: { responsesPerTest: limits.responsesPerTest },
  };
}
