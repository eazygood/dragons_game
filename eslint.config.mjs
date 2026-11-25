import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

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
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
  // Layer rules from docs/agent_docs/architecture.md §Layers: dependencies move downward only.
  {
    files: ['apps/api/src/cli/**/*.ts'],
    // The composition root wires the database and the upstream, as app.ts does for the server.
    ignores: ['apps/api/src/cli/live-runtime.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/repositories/**', '**/adapters/**'],
              message: 'The CLIs call managers only.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/routes/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/managers/**',
                '**/repositories/**',
                '**/adapters/**',
                '**/domain/**',
                '**/cli/**',
              ],
              message: 'Routes call mediators only.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/plugins/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/managers/**', '**/repositories/**', '**/domain/**', '**/cli/**'],
              message:
                'Plugins wire infrastructure; they never reach managers, repositories or the engine.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/mediators/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/repositories/**',
                '**/adapters/**',
                '**/domain/**',
                '**/cli/**',
                '**/routes/**',
              ],
              message: 'Mediators compose managers; they never reach lower or call upward.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/managers/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/adapters/**', '!**/adapters/mysql-adapter.ts', '**/cli/**'],
              message: 'Managers call repositories; only withTransaction comes from an adapter.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/repositories/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/managers/**', '**/cli/**'], message: 'Repositories never call upward.' },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'node:*',
                '**/adapters/**',
                '**/cli/**',
                '**/config/**',
                '**/entities/**',
                '**/managers/**',
                '**/repositories/**',
              ],
              message: 'The engine is pure: no I/O and no imports from outside domain/.',
            },
          ],
        },
      ],
    },
  },
);
