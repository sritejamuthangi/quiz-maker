import { afterEach } from 'vitest';

// Only frontend (jsdom) tests need DOM matchers, cleanup and a few browser APIs jsdom lacks.
if (typeof window !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  await import('@testing-library/jest-dom/vitest');

  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });
}
