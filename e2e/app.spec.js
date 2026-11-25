// End-to-end tests through a real browser, real API and isolated SQLite file.
// Run with: npm run test:e2e
import { expect, test as base } from '@playwright/test';
import readExcelFile from 'read-excel-file/node';

const BASE = 'http://127.0.0.1:5174';
const API = 'http://127.0.0.1:5055';
const created = [];

const test = base.extend({
  context: async ({ context }, use) => {
    // Playwright's default browser context does not grant clipboard access.
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
    await use(context);
  },
});

test.afterAll(async () => {
  for (const c of created) {
    await fetch(`${API}/api/manage/${c.publicId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${c.adminKey}` },
    }).catch(() => {});
  }
});

const OPTIONS = (...texts) => texts.map((text, i) => ({ id: `o${i + 1}`, text }));
const SINGLE = (id = 'q1', text = 'Which city is the capital of France?', correct = 'o1', points = 1) => ({
  id,
  type: 'single',
  text,
  explanation: 'Paris has been the capital of France since 987.',
  points,
  options: OPTIONS('Paris', 'London', 'Berlin'),
  correct,
});
const TRUE_FALSE = (id = 'q2', text = 'The Earth orbits the Sun.', correct = true, points = 1) => ({
  id,
  type: 'truefalse',
  text,
  explanation: 'One orbit takes about 365 days.',
  points,
  correct,
});

async function createTestViaApi({ title = 'E2E API test', description = '', questions, settings = {} }) {
  const reply = await fetch(`${API}/api/tests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      description,
      questions,
      settings: { requireName: true, resultsVisibility: 'full', ...settings },
    }),
  });
  const body = await reply.json();
  expect(reply.status, JSON.stringify(body)).toBe(201);
  created.push({ publicId: body.publicId, adminKey: body.adminKey });
  return body;
}

const attemptKey = (publicId) => `qm:attempt:${publicId}`;

test('create, share, take with reload/resume, submit, review, dashboard and Excel export', async ({ page }) => {
  await page.goto('/create');
  await page.getByRole('button', { name: /^Blank/ }).click();
  await expect(page.getByRole('heading', { name: 'New test' })).toBeVisible();

  await page.getByLabel('Test title').fill('E2E science quiz');
  await page.getByLabel('Instructions (optional)').fill('Testing the whole flow.');

  // 1. Single choice
  const q1 = page.getByRole('region', { name: 'Question 1' });
  await q1.getByRole('textbox', { name: 'Question', exact: true }).fill('What is 2 + 2?');
  await q1.getByLabel('Option A', { exact: true }).fill('3');
  await q1.getByLabel('Option B', { exact: true }).fill('4');
  await q1.getByLabel('Option C', { exact: true }).fill('5');
  await q1.getByLabel('Option B is correct').check();
  await q1.getByLabel('Explanation (optional)').fill('Two plus two is four.');

  // 2. Checkboxes / multiple answers
  await page.getByRole('button', { name: 'Checkboxes', exact: true }).click();
  const q2 = page.getByRole('region', { name: 'Question 2' });
  await q2.getByRole('textbox', { name: 'Question', exact: true }).fill('Which numbers are prime?');
  await q2.getByLabel('Option A', { exact: true }).fill('2');
  await q2.getByLabel('Option B', { exact: true }).fill('3');
  await q2.getByLabel('Option C', { exact: true }).fill('4');
  await q2.getByLabel('Option D', { exact: true }).fill('5');
  await q2.getByLabel('Option B is correct').check();
  await q2.getByLabel('Option D is correct').check();
  await q2.getByLabel('Explanation (optional)').fill('Prime numbers have exactly two factors.');

  // 3. True / false
  await page.getByRole('button', { name: 'True / False', exact: true }).click();
  const q3 = page.getByRole('region', { name: 'Question 3' });
  await q3.getByLabel('Statement').fill('The Earth orbits the Sun.');
  await q3.getByRole('button', { name: 'True', exact: true }).click();

  // 4. Fill in the blank, two blanks, with alternate spelling
  await page.getByRole('button', { name: 'Fill in the blank', exact: true }).click();
  const q4 = page.getByRole('region', { name: 'Question 4' });
  await q4.getByLabel('Sentence with [answers] in brackets').fill('France is [Paris], Spain is [Madrid].');
  await q4.getByLabel('Explanation (optional)').fill('Geography basics.');

  // Preview runs the same components with the same grading code.
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByText(/Preview: nothing is saved or sent/)).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

  // Publish and capture both links from the share dialog.
  await page.getByRole('button', { name: 'Publish' }).click();
  const share = page.getByRole('dialog');
  await expect(share.getByText('Your test is live!')).toBeVisible();
  const testLink = await share.getByLabel('Test link').inputValue();
  const privateLink = await share.getByLabel('Private results link').inputValue();
  expect(testLink).toMatch(/^http:\/\/127\.0\.0\.1:5174\/t\/[a-z0-9]{10}$/);
  expect(privateLink).toMatch(/#key=[A-Za-z0-9_-]{32}$/);

  const publicId = new URL(testLink).pathname.split('/').pop();
  const adminKey = new URL(privateLink).hash.replace('#key=', '');
  created.push({ publicId, adminKey });

  await share.getByRole('button', { name: 'Copy', exact: true }).first().click();
  await expect(share.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(testLink);
  await share.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByRole('heading', { name: 'E2E science quiz' })).toBeVisible();
  await expect(page.getByText('No responses yet')).toBeVisible();

  // Take the test in the same browser (the realistic creator-preview path).
  await page.goto(testLink);
  await expect(page.getByRole('heading', { name: 'E2E science quiz' })).toBeVisible();
  await page.getByLabel('Your name').fill('Ada Lovelace');
  await page.getByRole('button', { name: 'Start', exact: true }).click();

  await expect(page.getByText('Question 1 of 4', { exact: true })).toBeVisible();
  await expect(page.getByText('What is 2 + 2?', { exact: true })).toBeVisible();
  await page.getByRole('radio', { name: '4', exact: true }).check();
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByText('Question 2 of 4', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: '2', exact: true }).check();
  await page.getByRole('checkbox', { name: '3', exact: true }).check();
  await expect(page.getByText('2 of 4 answered')).toBeVisible();

  // Reload: answers and position must be restored from this device.
  await page.reload();
  await expect(page.getByText('Question 2 of 4', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '2', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: '3', exact: true })).toBeChecked();

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Question 3 of 4', { exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'True', exact: true }).check();
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByText('Question 4 of 4', { exact: true })).toBeVisible();
  await page.getByLabel('Blank 1 of 2').fill('  paris. ');
  await page.getByLabel('Blank 2 of 2').fill('MADRID');

  // Reload again after the last text field, then submit.
  await page.reload();
  await expect(page.getByText('Question 4 of 4', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Blank 1 of 2')).toHaveValue('  paris. ');
  await expect(page.getByLabel('Blank 2 of 2')).toHaveValue('MADRID');

  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  const confirm = page.getByRole('dialog');
  await expect(confirm.getByText('Submit your answers?')).toBeVisible();
  await expect(confirm.getByText(/You answered every question/)).toBeVisible();
  await confirm.getByRole('button', { name: 'Submit', exact: true }).click();

  // One deliberately wrong answer (Q2: selected 2 and 3, correct are 3 and 5).
  await expect(page.getByLabel('Score 3 out of 4')).toBeVisible();
  await expect(page.getByText('75%', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Incorrect', { exact: true })).toBeVisible();
  await expect(page.getByText('Prime numbers have exactly two factors.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Wrong or skipped \(1\)/ })).toBeVisible();

  // A submitted result survives a reload on the same device.
  await page.reload();
  await expect(page.getByText('You already submitted this test on this device. Here is your result.')).toBeVisible();
  await expect(page.getByLabel('Score 3 out of 4')).toBeVisible();

  // Private dashboard: summary, response details and a real Excel download.
  await page.goto(privateLink);
  await expect(page.getByRole('heading', { name: 'E2E science quiz' })).toBeVisible();
  await expect(page.getByText('1 response', { exact: true })).toBeVisible();
  await expect(page.getByText('Average score')).toBeVisible();
  await expect(page.getByText('75%', { exact: true }).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Responses (1)' }).click();
  await page.getByRole('row', { name: 'Open answers of Ada Lovelace' }).click();
  const response = page.getByRole('dialog');
  await expect(response.getByText('Ada Lovelace', { exact: true })).toBeVisible();
  await expect(response.getByText('3/4 · 75%', { exact: true })).toBeVisible();
  await expect(response.getByText('Question 2', { exact: true })).toBeVisible();
  await response.getByRole('button', { name: 'Close' }).click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Excel' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('E2E science quiz - results.xlsx');
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const sheets = await readExcelFile(downloadPath);
  expect(sheets.map((s) => s.sheet)).toEqual(['Responses', 'Questions', 'Summary']);
  const [head, row] = sheets[0].data;
  const column = (name) => head.indexOf(name);
  expect(row[column('Name')]).toBe('Ada Lovelace');
  expect(row[column('Score')]).toBe(3);
  expect(row[column('Out of')]).toBe(4);
  expect(row[column('Percent')]).toBe(0.75);
  expect(row[column('Q2. Which numbers are prime?')]).toMatch(/^✗/);
  expect(sheets[1].data.some((cells) => cells.includes('Paris | Madrid'))).toBe(true);
  expect(sheets[2].data).toContainEqual(['Responses', 1]);

  // The answer key is locked now that responses exist; wording is still editable.
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Edit questions' }).click();
  await expect(page.getByRole('heading', { name: 'Edit test' })).toBeVisible();
  await expect(page.getByText(/People have already answered this test/)).toBeVisible();
  await expect(page.getByLabel('Option B is correct').first()).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Question 1' }).getByLabel('Option A', { exact: true })).toBeEnabled();
  await expect(page.getByText('Add a question', { exact: true })).toHaveCount(0);
});

test('a timed attempt auto-submits after the deadline and is flagged overtime', async ({ page }) => {
  const { publicId, adminKey } = await createTestViaApi({
    title: 'E2E timed exam',
    questions: [SINGLE()],
    settings: { timeLimitMinutes: 1 },
  });

  await page.goto(`${BASE}/t/${publicId}`);
  await page.getByLabel('Your name').fill('Grace Hopper');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByLabel(/^Time left:/)).toBeVisible();
  await page.getByRole('radio', { name: 'Paris', exact: true }).check();

  // Make the attempt ten minutes old, then reopen it with only a few seconds left.
  // (Real waiting is unnecessary; the browser and server still use their real paths.)
  const token = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).token, attemptKey(publicId));
  const aged = await fetch(`${API}/api/test/age-attempt-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, ageSeconds: 600 }),
  });
  expect(aged.ok).toBe(true);
  const { token: agedToken } = await aged.json();
  // Leave the test first so its live state cannot overwrite the edited snapshot.
  await page.goto(BASE);
  await page.evaluate(
    ({ key, nextToken }) => {
      const attempt = JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify({ ...attempt, token: nextToken, deadline: Date.now() + 4000 }));
    },
    { key: attemptKey(publicId), nextToken: agedToken },
  );

  await page.goto(`${BASE}/t/${publicId}`);
  await expect(page.getByLabel(/^Time left:/)).toBeVisible();
  await expect(page.getByLabel('Score 1 out of 1')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('This was submitted after the time limit. The test creator can see that.')).toBeVisible();

  // The dashboard shows the overtime flag.
  await page.goto(`${BASE}/manage/${publicId}#key=${adminKey}`);
  await page.getByRole('tab', { name: 'Responses (1)' }).click();
  await expect(page.getByRole('row', { name: 'Open answers of Grace Hopper' }).getByText('Overtime')).toBeVisible();
});

test('a lost submission keeps the locked answer snapshot and succeeds on retry', async ({ page }) => {
  const { publicId } = await createTestViaApi({ title: 'E2E retry', questions: [SINGLE()] });

  await page.goto(`${BASE}/t/${publicId}`);
  await page.getByLabel('Your name').fill('Katherine Johnson');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('radio', { name: 'Paris', exact: true }).check();

  // Simulate a dropped connection during the one and only submit request.
  await page.route('**/api/tests/*/submit', (route) => route.abort('internetdisconnected'));
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Submit', exact: true }).click();

  await expect(page.getByText(/Can't reach the server/)).toBeVisible();
  await expect(page.getByText(/Your answers are locked for submission/)).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Paris', exact: true })).toBeDisabled();

  // Reconnect and retry the same frozen snapshot.
  await page.unroute('**/api/tests/*/submit');
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByLabel('Score 1 out of 1')).toBeVisible();

  const saved = await page.evaluate((key) => localStorage.getItem(`qm:result:${key}`), publicId);
  expect(JSON.parse(saved).result.score).toBe(1);
});

test.describe('mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('home and builder fit a phone screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Make a test in minutes/ })).toBeVisible();
    const cta = await page.getByRole('link', { name: /Create a test/ }).first().boundingBox();
    expect(cta.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

    await page.goto('/create');
    await page.getByRole('button', { name: /^Blank/ }).click();
    await expect(page.getByLabel('Test title')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Question', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

    // Answer controls are large enough to tap.
    const option = await page.getByRole('radio', { name: 'Option A is correct' }).boundingBox();
    expect(option.width).toBeGreaterThanOrEqual(32);
    expect(option.height).toBeGreaterThanOrEqual(32);
  });
});
