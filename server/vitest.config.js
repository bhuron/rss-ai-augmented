import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.test.js',
        '**/*.config.js',
      ],
    },
    include: ['test/**/*.test.js'],
    testTimeout: 15000, // 15 second timeout for feed sync tests
  },
});
