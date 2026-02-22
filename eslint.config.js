// @ts-check
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

export default defineConfig(
  globalIgnores(['dist/**', 'node_modules/**']),

  {
    files: ['backend/src/**/*.{ts,tsx}', 'frontend/src/**/*.{ts,tsx}', 'shared/**/*.ts'],
    extends: [tseslint.configs.recommended],
    plugins: {
      // @ts-ignore
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // TypeScript
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },

  prettierConfig,
);
