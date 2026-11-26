import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

import { layerBoundaries } from './eslint.boundaries.mjs';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '.worktrees/**',
      '*.mjs',
      '**/routeTree.gen.ts',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      'max-lines': ['error', 200],
      '@typescript-eslint/consistent-type-imports': 'error',
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: 'expression' },
      ],
    },
  },
  {
    // One file per manager, so a manager holds its whole entity's workflow.
    files: ['apps/api/src/managers/*.ts'],
    rules: { 'max-lines': 'off' },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
  ...layerBoundaries,
);
