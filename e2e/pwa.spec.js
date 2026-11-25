// Checks the real production build: installable manifest, service worker and precache.
// Run with: npm run test:pwa
import { expect, test } from '@playwright/test';

test('the production build is installable, registers a service worker and precaches the app', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Make a test in minutes/ })).toBeVisible();

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();
  const manifest = await (await page.request.get(manifestHref)).json();
  expect(manifest).toMatchObject({
    name: 'Quiz Maker',
    short_name: 'Quiz Maker',
    start_url: '/',
    display: 'standalone',
    theme_color: '#0b5a72',
    background_color: '#f5f7f8',
  });
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: '64x64' }),
      expect.objectContaining({ sizes: '192x192' }),
      expect.objectContaining({ sizes: '512x512' }),
    ]),
  );
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);

  const registration = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return {
      scope: reg.scope,
      scriptURL: reg.active?.scriptURL ?? '',
    };
  });
  expect(registration.scope).toBe(`${new URL(page.url()).origin}/`);
  expect(registration.scriptURL).toContain('/sw.js');
  await expect
    .poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state))
    .toBe('activated');

  // The page loaded before the worker took control; one reload makes it controlled.
  await page.reload();
  await expect(page.getByRole('heading', { name: /Make a test in minutes/ })).toBeVisible();
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls = [];
    for (const name of names) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) urls.push(new URL(request.url).pathname);
    }
    return { names, urls };
  });
  expect(cached.names.length).toBeGreaterThan(0);
  expect(cached.urls).toEqual(expect.arrayContaining(['/index.html', '/manifest.webmanifest']));
  expect(cached.urls.some((path) => path.startsWith('/assets/'))).toBe(true);

  // API calls still go to the real server through the preview proxy.
  const health = await page.request.get('/api/health');
  expect(health.ok()).toBe(true);
  expect((await health.json()).ok).toBe(true);

  // The document sends the production security headers.
  const response = await page.request.get('/');
  expect(response.headers()['content-security-policy']).toContain("default-src 'self'");
  expect(response.headers()['x-frame-options']).toBe('DENY');
});
