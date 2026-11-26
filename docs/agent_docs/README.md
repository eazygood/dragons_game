# Agent Docs Index

On-demand documentation for `dragons_game`. [`CLAUDE.md`](../../CLAUDE.md) is
the entry point and stays short; the detail lives here.

| Document                                                         | Content                                                                                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`architecture.md`](architecture.md)                             | Layer boundaries and invocation rules, the **verified API reference** (the published docs are wrong), the decision engine, bot runtime, diagrams |
| [`database.md`](database.md)                                     | Schema and ERD, knex patterns, migrations, transaction boundaries, why dragon level is persisted                                                 |
| [`routes.md`](routes.md)                                         | Route organisation, request/response schemas, validation, error mapping, serving the web app                                                     |
| [`frontend.md`](frontend.md)                                     | State management, the three validation boundaries, error states, component rules, responsiveness, a11y                                           |
| [`testing.md`](testing.md)                                       | Test levels, recorded fixtures and replay, the benchmark, E2E with an intercepted `/api`, CI, what may touch the live API                        |
| [`findings/phase-1-benchmark.md`](findings/phase-1-benchmark.md) | Raw benchmark numbers: baseline vs calibrated, the reward trap, the threshold sweep, acceptance and the re-measure                               |

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
- **Changing the strategy?** `findings/phase-1-benchmark.md` for what was
  measured, then `pnpm bench` before and after.

Local design notes may live in `docs/superpowers/`. That directory is gitignored
and not part of the repo, so nothing here may depend on it.
