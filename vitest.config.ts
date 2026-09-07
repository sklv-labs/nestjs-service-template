import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'packages/*/src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'packages/*/src/**/*.ts'],
      exclude: ['**/*.d.ts', '**/index.ts', 'src/main.ts'],
      reporter: ['text', 'lcov'],
    },
  },
});
