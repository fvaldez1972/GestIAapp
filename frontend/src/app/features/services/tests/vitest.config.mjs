import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/app/features/services/**/*.spec.ts'],
    setupFiles: ['src/app/features/services/tests/setup.mjs'],
    fileParallelism: false,
    cache: false,
  },
});
