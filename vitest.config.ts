import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/claude-code-client/vitest.config.ts',
      'backend/vitest.config.ts',
      'frontend/vitest.config.ts',
    ],
  },
});
