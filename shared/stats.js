import { normalizeAnswer, parseBlanks } from './blanks.js';
import { isAnswered } from './grading.js';

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Dashboard statistics.
 * @param test      { questions, settings }
 * @param attempts  [{ percent, durationSeconds, questionIds, answers, results }]
 */
export function computeStats(test, attempts) {
  const n = attempts.length;
  const percents = attempts.map((a) => a.percent).sort((a, b) => a - b);
  const total = percents.reduce((sum, p) => sum + p, 0);
  const median = n === 0 ? null : n % 2 ? percents[(n - 1) / 2] : (percents[n / 2 - 1] + percents[n / 2]) / 2;
  const durations = attempts.map((a) => a.durationSeconds).filter((d) => Number.isFinite(d));
  const passPercent = test.settings?.passPercent ?? null;

  const histogram = Array(10).fill(0); // 0–9%, 10–19%, … 90–100%
  for (const p of percents) histogram[Math.min(9, Math.max(0, Math.floor(p / 10)))] += 1;

  const summary = {
    responses: n,
    averagePercent: n ? round1(total / n) : null,
    medianPercent: n ? round1(median) : null,
    highestPercent: n ? percents[n - 1] : null,
    lowestPercent: n ? percents[0] : null,
    averageDurationSeconds: durations.length
      ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
      : null,
    passPercent,
    passedCount: passPercent == null ? null : attempts.filter((a) => a.percent >= passPercent).length,
    histogram,
  };

  const questionById = new Map(test.questions.map((q) => [q.id, q]));
  const statsById = new Map();
  for (const q of test.questions) {
    const s = { id: q.id, served: 0, answered: 0, correct: 0 };
    if (q.type === 'single' || q.type === 'multiple') s.options = Object.fromEntries(q.options.map((o) => [o.id, 0]));
    if (q.type === 'truefalse') {
      s.trueCount = 0;
      s.falseCount = 0;
    }
    if (q.type === 'blank') {
      const count = parseBlanks(q.text).blanks.length;
      s.blanks = Array.from({ length: count }, () => ({ correct: 0, wrong: new Map() }));
    }
    statsById.set(q.id, s);
  }

  for (const attempt of attempts) {
    for (const id of attempt.questionIds ?? []) {
      const q = questionById.get(id);
      const s = statsById.get(id);
      if (!q || !s) continue;
      const answer = attempt.answers?.[id];
      const result = attempt.results?.[id];
      s.served += 1;
      if (isAnswered(q, answer)) s.answered += 1;
      if (result?.correct) s.correct += 1;

      if (q.type === 'single' && typeof answer === 'string' && Object.hasOwn(s.options, answer)) {
        s.options[answer] += 1;
      }
      if (q.type === 'multiple' && Array.isArray(answer)) {
        for (const optionId of answer) if (Object.hasOwn(s.options, optionId)) s.options[optionId] += 1;
      }
      if (q.type === 'truefalse') {
        if (answer === true) s.trueCount += 1;
        else if (answer === false) s.falseCount += 1;
      }
      if (q.type === 'blank' && Array.isArray(answer)) {
        s.blanks.forEach((blank, i) => {
          if (result?.blanks?.[i]) {
            blank.correct += 1;
            return;
          }
          const raw = String(answer[i] ?? '').trim();
          if (!raw) return;
          const key = normalizeAnswer(raw, !!q.caseSensitive);
          const entry = blank.wrong.get(key) ?? { answer: raw, count: 0 };
          entry.count += 1;
          blank.wrong.set(key, entry);
        });
      }
    }
  }

  const questions = test.questions.map((q) => {
    const s = statsById.get(q.id);
    const out = { ...s, percentCorrect: s.served ? round1((100 * s.correct) / s.served) : null };
    if (s.blanks) {
      out.blanks = s.blanks.map((b) => ({
        correct: b.correct,
        percentCorrect: s.served ? round1((100 * b.correct) / s.served) : null,
        topWrong: [...b.wrong.values()].sort((x, y) => y.count - x.count).slice(0, 5),
      }));
    }
    return out;
  });

  return { summary, questions };
}
