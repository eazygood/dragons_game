# Agent Docs Index

On-demand documentation for `bigbank_dragon`. [`CLAUDE.md`](../../CLAUDE.md) is
the entry point and stays short; the detail lives here.

| Document                             | Content                                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`architecture.md`](architecture.md) | Layer boundaries and invocation rules, the **verified API reference** (the published docs are wrong), the decision engine, bot runtime, diagrams |
| [`database.md`](database.md)         | Schema and ERD, knex patterns, migrations, transaction boundaries, why dragon level is persisted                                                 |
| [`routes.md`](routes.md)             | Route organisation, request/response schemas, validation, error mapping, SSE                                                                     |
| [`frontend.md`](frontend.md)         | State management, the three validation boundaries, error states, component rules, responsiveness, a11y                                           |
| [`testing.md`](testing.md)           | Test levels, recorded fixtures and replay, the benchmark, what CI may and may not touch                                                          |

## Where to start

- **Changing game logic?** `architecture.md` → _Decision engine_. The engine is
  pure; keep it that way.
- **Talking to the upstream API?** `architecture.md` → _Verified API reference_.
  Do not trust https://dragonsofmugloar.com/doc/ — it is materially wrong and the
  differences cause real bugs.
- **Adding an endpoint?** `routes.md`.
- **Touching the schema?** `database.md`.
- **Writing tests?** `testing.md`. Fixtures are recorded from the live API, never
  hand-written.

Working design notes and the original spec live in `docs/superpowers/` and are
gitignored — they are agent scratch space, not part of the deliverable.
