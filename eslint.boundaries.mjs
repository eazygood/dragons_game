// Layer rules from docs/agent_docs/architecture.md §Layers: dependencies move downward only.
export const layerBoundaries = [
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
              group: [
                '**/managers/**',
                '**/repositories/**',
                '**/domain/**',
                '**/cli/**',
                '**/routes/**',
              ],
              message:
                'Plugins wire infrastructure; they never reach managers, repositories, the engine or routes.',
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
            {
              group: ['../*-mediator/**'],
              message:
                'A mediator never imports a sibling mediator; shared code lives in mediators/shared.',
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
              group: ['**/adapters/**'],
              allowImportNames: ['withTransaction'],
              message: 'Managers call repositories; only withTransaction comes from an adapter.',
            },
            { group: ['**/cli/**'], message: 'Managers never call upward.' },
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
            {
              group: ['../*-repository/**'],
              message: 'A repository serves one entity; composing two is a manager job.',
            },
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
                'knex',
                'fastify',
                '@fastify/*',
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
      // The clock, randomness and the network are inputs the caller passes in, never ambient.
      'no-restricted-globals': [
        'error',
        ...['Date', 'process', 'fetch', 'setTimeout', 'setInterval'].map((name) => ({
          name,
          message: 'The engine is pure: time, environment and I/O arrive as arguments.',
        })),
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'The engine is pure: randomness arrives as an argument.',
        },
      ],
    },
  },
];
