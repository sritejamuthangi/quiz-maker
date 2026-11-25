import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { loadConfig } from '../config.js';
import { createDatabase } from '../db.js';
import { attemptVersion, signAttemptToken } from '../lib/security.js';
import { sampleQuestions } from '../../shared/__tests__/fixtures.js';

const SECRET = 'test-secret-that-is-long-enough-1234567890';
const open = [];

async function setup(env = {}) {
  const config = loadConfig({ APP_SECRET: SECRET, SQLITE_STORAGE: ':memory:', CRON_SECRET: 'cron-secret', ...env });
  const db = createDatabase(config);
  await db.sequelize.sync();
  open.push(db);
  const app = createApp({ config, db });
  return { app, db, config, api: () => request(app) };
}

afterEach(async () => {
  while (open.length) await open.pop().sequelize.close();
  vi.restoreAllMocks();
});

const body = (overrides = {}) => ({ title: 'Science quiz', description: 'Week 1', questions: sampleQuestions(), ...overrides });

async function createTest(ctx, overrides) {
  const res = await ctx.api().post('/api/tests').send(body(overrides));
  expect(res.status).toBe(201);
  return res.body;
}

async function start(ctx, publicId) {
  const res = await ctx.api().post(`/api/tests/${publicId}/start`).send({});
  expect(res.status).toBe(200);
  return res.body;
}

const perfectAnswers = { q1: 'b', q2: ['a', 'c'], q3: true, q4: ['paris', 'Madrid'] };

describe('creating tests', () => {
  it('creates a test and returns the share id and private key', async () => {
    const ctx = await setup();
    const res = await ctx.api().post('/api/tests').send(body());
    expect(res.status).toBe(201);
    expect(res.body.publicId).toMatch(/^[2-9a-hjkmnp-z]{10}$/);
    expect(res.body.adminKey).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const days = (new Date(res.body.expiresAt) - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
    const row = await ctx.db.Test.findOne({ where: { publicId: res.body.publicId } });
    expect(row.adminKeyHash).not.toContain(res.body.adminKey);
    expect(row.creatorIpHash).toHaveLength(32);
  });

  it('rejects invalid tests with readable messages', async () => {
    const ctx = await setup();
    const res = await ctx.api().post('/api/tests').send({ title: '', questions: [] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid_input');
    expect(res.body.issues.map((i) => i.message)).toEqual(
      expect.arrayContaining(['Title is required', 'Add at least one question']),
    );
  });

  it('rejects the honeypot field and oversized bodies', async () => {
    const ctx = await setup();
    expect((await ctx.api().post('/api/tests').send(body({ website: 'spam.example' }))).status).toBe(400);
    const huge = await ctx.api().post('/api/tests').send({ title: 'x', description: 'x'.repeat(600 * 1024) });
    expect(huge.status).toBe(413);
  });

  it('limits how many tests one IP can create', async () => {
    const ctx = await setup({ LIMIT_TESTS_PER_IP_HOUR: '2' });
    await createTest(ctx);
    await createTest(ctx);
    const res = await ctx.api().post('/api/tests').send(body());
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('quota_hour');
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('applies the site-wide daily limit and the kill switch', async () => {
    const ctx = await setup({ LIMIT_TESTS_PER_DAY_GLOBAL: '1' });
    await createTest(ctx);
    expect((await ctx.api().post('/api/tests').send(body())).body.code).toBe('quota_global');
    const paused = await setup({ CREATION_ENABLED: 'false' });
    expect((await paused.api().post('/api/tests').send(body())).status).toBe(503);
  });

  it('verifies Turnstile when it is configured', async () => {
    const ctx = await setup({ TURNSTILE_SECRET_KEY: 'ts-secret' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ success: false }), { status: 200 }));
    const blocked = await ctx.api().post('/api/tests').send(body({ turnstileToken: 'bad' }));
    expect(blocked.status).toBe(403);
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
    expect((await ctx.api().post('/api/tests').send(body({ turnstileToken: 'good' }))).status).toBe(201);
    expect(fetchSpy.mock.calls[1][1].body.get('secret')).toBe('ts-secret');
  });
});

describe('taking a test', () => {
  it('shows public info without questions, cached briefly', async () => {
    const ctx = await setup();
    const { publicId } = await createTest(ctx, { settings: { timeLimitMinutes: 20, extraFieldLabel: 'Roll number' } });
    const res = await ctx.api().get(`/api/tests/${publicId}`);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('s-maxage=30');
    expect(res.body).toMatchObject({
      title: 'Science quiz',
      questionCount: 4,
      totalPoints: 5,
      status: 'open',
      settings: { timeLimitMinutes: 20, extraFieldLabel: 'Roll number', resultsVisibility: 'full' },
    });
    expect(res.body.questions).toBeUndefined();
    expect((await ctx.api().get('/api/tests/zzzzzzzzzz')).status).toBe(404);
    expect((await ctx.api().get('/api/tests/not-valid!')).status).toBe(404);
  });

  it('never sends answers or explanations when starting', async () => {
    const ctx = await setup();
    const { publicId } = await createTest(ctx);
    const started = await start(ctx, publicId);
    expect(started.token).toBeTruthy();
    expect(started.questions).toHaveLength(4);
    const json = JSON.stringify(started);
    for (const secret of ['"correct"', 'explanation', 'Paris', 'Madrid', '2 + 2 = 4', 'Geography']) {
      expect(json).not.toContain(secret);
    }
  });

  it('grades on submit and returns the full review', async () => {
    const ctx = await setup();
    const { publicId } = await createTest(ctx, { settings: { passPercent: 50 } });
    const { token } = await start(ctx, publicId);
    const res = await ctx.api().post(`/api/tests/${publicId}/submit`).send({
      token,
      name: 'Asha',
      answers: { ...perfectAnswers, q2: ['a'] },
      tabLeaves: 2,
    });
    expect(res.status).toBe(201);
    const { result } = res.body;
    expect(result).toMatchObject({ score: 3, maxScore: 5, percent: 60, passed: true, passPercent: 50, overtime: false });
    expect(result.review).toHaveLength(4);
    expect(result.review.find((r) => r.id === 'q2')).toMatchObject({
      correct: false,
      correctAnswer: ['a', 'c'],
      explanation: 'Primes have exactly two divisors.',
    });
    const stored = await ctx.db.Attempt.findOne();
    expect(stored).toMatchObject({ name: 'Asha', score: 3, tabLeaves: 2 });
    expect((await ctx.db.Test.findOne()).responseCount).toBe(1);
  });

  it('is safe to submit the same attempt twice', async () => {
    const ctx = await setup();
    const { publicId } = await createTest(ctx);
    const { token } = await start(ctx, publicId);
    const payload = { token, name: 'Ravi', answers: perfectAnswers };
    const [a, b] = await Promise.all([
      ctx.api().post(`/api/tests/${publicId}/submit`).send(payload),
      ctx.api().post(`/api/tests/${publicId}/submit`).send(payload),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(a.body.result.score).toBe(5);
    expect(b.body.result.score).toBe(5);
    expect(await ctx.db.Attempt.count()).toBe(1);
    expect((await ctx.db.Test.findOne()).responseCount).toBe(1);
  });

  it('respects the results visibility setting', async () => {
    const ctx = await setup();
    const marks = await createTest(ctx, { settings: { resultsVisibility: 'marks' } });
    const t1 = await start(ctx, marks.publicId);
    const r1 = await ctx.api().post(`/api/tests/${marks.publicId}/submit`).send({ token: t1.token, name: 'A', answers: {} });
    expect(r1.body.result.review[0].correct).toBe(false);
    expect(JSON.stringify(r1.body.result)).not.toContain('correctAnswer');
    expect(JSON.stringify(r1.body.result)).not.toContain('explanation');

    const scoreOnly = await createTest(ctx, { settings: { resultsVisibility: 'score' } });
    const t2 = await start(ctx, scoreOnly.publicId);
    const r2 = await ctx.api().post(`/api/tests/${scoreOnly.publicId}/submit`).send({ token: t2.token, name: 'A', answers: perfectAnswers });
    expect(r2.body.result).toMatchObject({ score: 5, review: [] });
  });

  it('rejects forged, tampered and mismatched tokens', async () => {
    const ctx = await setup();
    const one = await createTest(ctx);
    const two = await createTest(ctx);
    const { token } = await start(ctx, one.publicId);
    const submit = (id, t) => ctx.api().post(`/api/tests/${id}/submit`).send({ token: t, name: 'X', answers: {} });

    expect((await submit(two.publicId, token)).status).toBe(400);
    const [bodyPart, sig] = token.split('.');
    const tampered = `${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(bodyPart, 'base64url')), s: Date.now() + 1e9 })).toString('base64url')}.${sig}`;
    expect((await submit(one.publicId, tampered)).status).toBe(400);
    const forged = signAttemptToken('another-secret', JSON.parse(Buffer.from(bodyPart, 'base64url')));
    expect((await submit(one.publicId, forged)).status).toBe(400);
  });

  it('requires the name and extra field when configured', async () => {
    const ctx = await setup();
    const { publicId } = await createTest(ctx, { settings: { extraFieldLabel: 'Roll number' } });
    const { token } = await start(ctx, publicId);
    const noName = await ctx.api().post(`/api/tests/${publicId}/submit`).send({ token, answers: {} });
    expect(noName.body.code).toBe('name_required');
    const noExtra = await ctx.api().post(`/api/tests/${publicId}/submit`).send({ token, name: 'A', answers: {} });
    expect(noExtra.body.code).toBe('extra_required');
  });

  it('flags overtime and rejects very old attempts', async () => {
    const ctx = await setup();
    const { publicId } = await createTest(ctx, { settings: { timeLimitMinutes: 1 } });
    const version = attemptVersion(SECRET, await ctx.db.Test.findOne());
    const tokenStartedAgo = (seconds) =>
      signAttemptToken(SECRET, { t: publicId, s: Date.now() - seconds * 1000, n: `nonce${seconds}`.padEnd(22, 'x'), r: 1, v: version });

    const late = await ctx.api().post(`/api/tests/${publicId}/submit`).send({ token: tokenStartedAgo(300), name: 'A', answers: {} });
    expect(late.status).toBe(201);
    expect(late.body.result).toMatchObject({ overtime: true, durationSeconds: 300 });

    const ontime = await ctx.api().post(`/api/tests/${publicId}/submit`).send({ token: tokenStartedAgo(50), name: 'B', answers: {} });
    expect(ontime.body.result.overtime).toBe(false);

    const ancient = await ctx.api().post(`/api/tests/${publicId}/submit`).send({ token: tokenStartedAgo(2 * 3600), name: 'C', answers: {} });
    expect(ancient.status).toBe(410);
  });

  it('gives each person N random questions and grades only those', async () => {
    const ctx = await setup();
    const { publicId } = await createTest(ctx, { settings: { questionsPerAttempt: 2 } });
    const meta = await ctx.api().get(`/api/tests/${publicId}`);
    expect(meta.body.questionCount).toBe(2);
    const { token, questions } = await start(ctx, publicId);
    expect(questions).toHaveLength(2);
    const res = await ctx.api().post(`/api/tests/${publicId}/submit`).send({ token, name: 'A', answers: perfectAnswers });
    const servedPoints = questions.reduce((sum, q) => sum + q.points, 0);
    expect(res.body.result).toMatchObject({ score: servedPoints, maxScore: servedPoints, percent: 100 });
    expect(res.body.result.review.map((r) => r.id)).toEqual(questions.map((q) => q.id));
  });

  it('stops new starts when closed but accepts people already taking it', async () => {
    const ctx = await setup();
    const { publicId, adminKey } = await createTest(ctx);
    const { token } = await start(ctx, publicId);
    const closed = await ctx.api().patch(`/api/manage/${publicId}`).set('Authorization', `Bearer ${adminKey}`).send({ isOpen: false });
    expect(closed.body.test.status).toBe('closed');
    const blocked = await ctx.api().post(`/api/tests/${publicId}/start`).send({});
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('closed');
    const late = await ctx.api().post(`/api/tests/${publicId}/submit`).send({ token, name: 'A', answers: {} });
    expect(late.status).toBe(201);
  });

  it('closes automatically at the "accept until" time', async () => {
    const ctx = await setup();
    const { publicId } = await createTest(ctx, { settings: { closesAt: new Date(Date.now() - 1000).toISOString() } });
    expect((await ctx.api().get(`/api/tests/${publicId}`)).body.status).toBe('closed');
    expect((await ctx.api().post(`/api/tests/${publicId}/start`)).status).toBe(403);
  });

  it('enforces the response limit and per-network submit limit', async () => {
    const ctx = await setup({ LIMIT_RESPONSES_PER_TEST: '1' });
    const { publicId } = await createTest(ctx);
    const first = await start(ctx, publicId);
    const second = await start(ctx, publicId);
    await ctx.api().post(`/api/tests/${publicId}/submit`).send({ token: first.token, name: 'A', answers: {} }).expect(201);
    const full = await ctx.api().post(`/api/tests/${publicId}/submit`).send({ token: second.token, name: 'B', answers: {} });
    expect(full.status).toBe(403);
    expect(full.body.code).toBe('full');
    expect((await ctx.api().post(`/api/tests/${publicId}/start`)).body.code).toBe('full');

    const limited = await setup({ LIMIT_SUBMITS_PER_IP_PER_TEST_HOUR: '1' });
    const t = await createTest(limited);
    const a = await start(limited, t.publicId);
    const b = await start(limited, t.publicId);
    await limited.api().post(`/api/tests/${t.publicId}/submit`).send({ token: a.token, name: 'A', answers: {} }).expect(201);
    const res = await limited.api().post(`/api/tests/${t.publicId}/submit`).send({ token: b.token, name: 'B', answers: {} });
    expect(res.status).toBe(429);
  });
});

describe('creator dashboard', () => {
  async function withResponse() {
    const ctx = await setup();
    const created = await createTest(ctx);
    const { token } = await start(ctx, created.publicId);
    await ctx.api().post(`/api/tests/${created.publicId}/submit`).send({ token, name: 'Asha', answers: perfectAnswers });
    const auth = (req) => req.set('Authorization', `Bearer ${created.adminKey}`);
    return { ...ctx, ...created, auth };
  }

  it('requires the right key', async () => {
    const ctx = await withResponse();
    expect((await ctx.api().get(`/api/manage/${ctx.publicId}`)).status).toBe(401);
    const wrong = await ctx.api().get(`/api/manage/${ctx.publicId}`).set('Authorization', `Bearer ${'x'.repeat(32)}`);
    expect(wrong.status).toBe(401);
    const missing = await ctx.api().get('/api/manage/zzzzzzzzzz').set('Authorization', `Bearer ${ctx.adminKey}`);
    expect(missing.status).toBe(401);
  });

  it('returns the test with answers, stats and responses, and supports ETag polling', async () => {
    const ctx = await withResponse();
    const res = await ctx.auth(ctx.api().get(`/api/manage/${ctx.publicId}`));
    expect(res.status).toBe(200);
    expect(res.body.test.questions[0].correct).toBe('b');
    expect(res.body.test.locked).toBe(true);
    expect(res.body.stats.summary).toMatchObject({ responses: 1, averagePercent: 100 });
    expect(res.body.responses).toEqual([expect.objectContaining({ name: 'Asha', score: 5, maxScore: 5 })]);
    expect(JSON.stringify(res.body.responses)).not.toContain('ipHash');

    const etag = res.headers.etag;
    const cached = await ctx.auth(ctx.api().get(`/api/manage/${ctx.publicId}`)).set('If-None-Match', etag);
    expect(cached.status).toBe(304);
  });

  it('locks the answer key once people have answered, but allows wording fixes', async () => {
    const ctx = await withResponse();
    const questions = sampleQuestions();
    questions[0].correct = 'a';
    const locked = await ctx.auth(ctx.api().patch(`/api/manage/${ctx.publicId}`)).send({ questions });
    expect(locked.status).toBe(409);
    expect(locked.body.code).toBe('locked');

    const fixed = sampleQuestions();
    fixed[0].text = 'What is two plus two?';
    const ok = await ctx.auth(ctx.api().patch(`/api/manage/${ctx.publicId}`)).send({ questions: fixed, title: 'Renamed' });
    expect(ok.status).toBe(200);
    expect(ok.body.test).toMatchObject({ title: 'Renamed' });
    expect(ok.body.test.questions[0].text).toBe('What is two plus two?');
  });

  it('merges settings and extends expiry', async () => {
    const ctx = await withResponse();
    const res = await ctx
      .auth(ctx.api().patch(`/api/manage/${ctx.publicId}`))
      .send({ settings: { passPercent: 70 }, extendDays: 90 });
    expect(res.status).toBe(200);
    expect(res.body.test.settings).toMatchObject({ passPercent: 70, requireName: true, resultsVisibility: 'full' });
    expect((new Date(res.body.test.expiresAt) - Date.now()) / 86400000).toBeGreaterThan(89.9);
    const bad = await ctx.auth(ctx.api().patch(`/api/manage/${ctx.publicId}`)).send({ settings: { passPercent: 500 } });
    expect(bad.status).toBe(400);
  });

  it('shows, exports and deletes individual responses', async () => {
    const ctx = await withResponse();
    const list = await ctx.auth(ctx.api().get(`/api/manage/${ctx.publicId}`));
    const id = list.body.responses[0].id;

    const detail = await ctx.auth(ctx.api().get(`/api/manage/${ctx.publicId}/responses/${id}`));
    expect(detail.body.review[3]).toMatchObject({ correct: true, correctAnswer: [['Paris'], ['Madrid']] });

    const exported = await ctx.auth(ctx.api().get(`/api/manage/${ctx.publicId}/export`));
    expect(exported.body.responses[0].answers.q4).toEqual(['paris', 'Madrid']);

    await ctx.auth(ctx.api().delete(`/api/manage/${ctx.publicId}/responses/${id}`)).expect(200);
    expect((await ctx.db.Test.findOne()).responseCount).toBe(0);
    expect((await ctx.auth(ctx.api().get(`/api/manage/${ctx.publicId}/responses/${id}`))).status).toBe(404);
  });

  it('deletes a test and everything in it', async () => {
    const ctx = await withResponse();
    await ctx.auth(ctx.api().delete(`/api/manage/${ctx.publicId}`)).expect(200);
    expect(await ctx.db.Attempt.count()).toBe(0);
    expect((await ctx.api().get(`/api/tests/${ctx.publicId}`)).status).toBe(404);
  });
});

describe('expiry and maintenance', () => {
  it('hides expired tests and the cron job deletes them', async () => {
    const ctx = await setup();
    const { publicId } = await createTest(ctx);
    await ctx.db.Test.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { publicId } });
    expect((await ctx.api().get(`/api/tests/${publicId}`)).status).toBe(410);

    expect((await ctx.api().get('/api/cron/cleanup')).status).toBe(401);
    expect((await ctx.api().get('/api/cron/cleanup').set('Authorization', 'Bearer nope')).status).toBe(401);
    const res = await ctx.api().get('/api/cron/cleanup').set('Authorization', 'Bearer cron-secret');
    expect(res.body).toEqual({ ok: true, deleted: 1 });
    expect(await ctx.db.Test.count()).toBe(0);
  });

  it('reports health and returns JSON 404s', async () => {
    const ctx = await setup();
    expect((await ctx.api().get('/api/health')).body).toEqual({ ok: true, database: 'up' });
    const missing = await ctx.api().get('/api/nope');
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('not_found');
    expect(missing.headers['cache-control']).toBe('no-store');
  });

  it('refuses to start in production without a proper secret', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/APP_SECRET/);
    expect(() => loadConfig({ VERCEL: '1', APP_SECRET: 'short' })).toThrow(/APP_SECRET/);
    expect(() => loadConfig({ VERCEL: '1', APP_SECRET: SECRET })).toThrow(/DATABASE_URL/);
    expect(loadConfig({ VERCEL: '1', APP_SECRET: SECRET, DATABASE_URL: 'postgres://example' }).limits.testsPerIpPerHour).toBe(10);
  });
});

describe('concurrent requests and in-progress attempts', () => {
  it('deduplicates simultaneous retries even when only one response slot exists', async () => {
    const ctx = await setup({ LIMIT_RESPONSES_PER_TEST: '1' });
    const { publicId } = await createTest(ctx);
    const { token } = await start(ctx, publicId);
    const replies = await Promise.all(Array.from({ length: 5 }, () =>
      ctx.api().post(`/api/tests/${publicId}/submit`).send({ token, name: 'A', answers: perfectAnswers }),
    ));
    expect(replies.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 201]);
    expect(await ctx.db.Attempt.count()).toBe(1);
    expect((await ctx.db.Test.findOne()).responseCount).toBe(1);
  });

  it('enforces response and network quotas under simultaneous distinct submissions', async () => {
    for (const limits of [{ LIMIT_RESPONSES_PER_TEST: '1' }, { LIMIT_SUBMITS_PER_IP_PER_TEST_HOUR: '1' }]) {
      const ctx = await setup(limits);
      const { publicId } = await createTest(ctx);
      const tokens = await Promise.all(Array.from({ length: 4 }, () => start(ctx, publicId)));
      const replies = await Promise.all(tokens.map(({ token }) =>
        ctx.api().post(`/api/tests/${publicId}/submit`).send({ token, name: 'A', answers: {} }),
      ));
      expect(replies.filter((r) => r.status === 201)).toHaveLength(1);
      expect(replies.filter((r) => r.status === (limits.LIMIT_RESPONSES_PER_TEST ? 403 : 429))).toHaveLength(3);
      expect((await ctx.db.Test.findOne()).responseCount).toBe(1);
    }
  });

  it('enforces simultaneous creation quotas', async () => {
    const ctx = await setup({ LIMIT_TESTS_PER_DAY_GLOBAL: '1' });
    const replies = await Promise.all(Array.from({ length: 4 }, () => ctx.api().post('/api/tests').send(body())));
    expect(replies.map((r) => r.status).sort()).toEqual([201, 429, 429, 429]);
  });

  it('rolls back the response and counter together if a write fails', async () => {
    const ctx = await setup();
    const { publicId } = await createTest(ctx);
    const { token } = await start(ctx, publicId);
    ctx.db.Test.addHook('beforeUpdate', 'failCounter', () => { throw new Error('simulated storage failure'); });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const payload = { token, name: 'A', answers: perfectAnswers };
    await ctx.api().post(`/api/tests/${publicId}/submit`).send(payload).expect(500);
    expect(await ctx.db.Attempt.count()).toBe(0);
    expect((await ctx.db.Test.findOne()).responseCount).toBe(0);
    ctx.db.Test.removeHook('beforeUpdate', 'failCounter');
    log.mockRestore();
    await ctx.api().post(`/api/tests/${publicId}/submit`).send(payload).expect(201);
  });

  it('rejects stale question sets instead of grading questions the person never saw', async () => {
    const ctx = await setup();
    const { publicId, adminKey } = await createTest(ctx);
    const { token } = await start(ctx, publicId);
    const questions = sampleQuestions();
    questions[0].correct = 'a';
    await ctx.api().patch(`/api/manage/${publicId}`).set('Authorization', `Bearer ${adminKey}`).send({ questions }).expect(200);
    const reply = await ctx.api().post(`/api/tests/${publicId}/submit`).send({ token, name: 'A', answers: perfectAnswers });
    expect(reply.status).toBe(409);
    expect(reply.body.code).toBe('test_changed');
    expect(await ctx.db.Attempt.count()).toBe(0);
  });

  it('allows an explanation edit during an attempt', async () => {
    const ctx = await setup();
    const { publicId, adminKey } = await createTest(ctx);
    const { token } = await start(ctx, publicId);
    const questions = sampleQuestions();
    questions[0].explanation = 'Updated explanation';
    await ctx.api().patch(`/api/manage/${publicId}`).set('Authorization', `Bearer ${adminKey}`).send({ questions }).expect(200);
    await ctx.api().post(`/api/tests/${publicId}/submit`).send({ token, name: 'A', answers: perfectAnswers }).expect(201);
  });

  it('returns an already-stored result even after the attempt retry window has expired', async () => {
    const ctx = await setup();
    const { publicId } = await createTest(ctx, { settings: { timeLimitMinutes: 1 } });
    const { token } = await start(ctx, publicId);
    const payload = { token, name: 'A', answers: perfectAnswers };
    await ctx.api().post(`/api/tests/${publicId}/submit`).send(payload).expect(201);
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 2 * 3600_000);
    const reply = await ctx.api().post(`/api/tests/${publicId}/submit`).send(payload).expect(200);
    expect(reply.body).toMatchObject({ duplicate: true, result: { score: 5 } });
  });

  it('never unlocks a submitted answer key during a competing edit', async () => {
    const ctx = await setup();
    const { publicId, adminKey } = await createTest(ctx);
    const { token } = await start(ctx, publicId);
    const questions = sampleQuestions();
    questions[0].correct = 'a';
    const [submit, edit] = await Promise.all([
      ctx.api().post(`/api/tests/${publicId}/submit`).send({ token, name: 'A', answers: perfectAnswers }),
      ctx.api().patch(`/api/manage/${publicId}`).set('Authorization', `Bearer ${adminKey}`).send({ questions }),
    ]);
    expect([[201, 409], [409, 200]]).toContainEqual([submit.status, edit.status]);
    expect((await ctx.db.Test.findOne()).responseCount).toBe(await ctx.db.Attempt.count());
  });
});
