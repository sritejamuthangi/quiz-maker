import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) },
  },
  test: {
    include: ['shared/**/*.test.js', 'backend/**/*.test.js', 'frontend/src/**/*.test.{js,jsx}'],
    // Backend and shared tests run in Node; frontend test files opt into jsdom with a
    // `@vitest-environment jsdom` comment at the top.
    environment: 'node',
    setupFiles: ['./frontend/src/test/setup.js'],
    restoreMocks: true,
    testTimeout: 20000,
  },
});
