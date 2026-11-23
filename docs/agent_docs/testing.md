# Testing

## Levels

| Level       | Tool                      | Covers                                                                               |
| ----------- | ------------------------- | ------------------------------------------------------------------------------------ |
| Unit        | Vitest                    | Engine (table-driven across labels, levels, boards), decoders, EV maths, calibration |
| Integration | Vitest + MySQL container  | Repositories, migrations, manager transactions                                       |
| Contract    | Vitest + mock server      | Adapter against **recorded** fixtures: HTML errors, `410`, both encryption modes     |
| API         | Vitest + `fastify.inject` | Routes, schemas, error mapping                                                       |
| Component   | Vitest + Testing Library  | Components with three or more states                                                 |
| E2E         | Playwright                | Full game flow against a stubbed upstream, 3 browsers, 2 viewports                   |
| Benchmark   | CLI, manual               | 20 live runs, pass rate against 1000                                                 |

The engine being **pure** is what makes the most important tests fast and
deterministic — no network, no database, no clock.

## What to assert

Pin the behaviour the brief cares about, not the implementation. A refactor must
not break a test. If a test knows which function called which, it is testing the
wrong thing.

The engine is the exception worth effort: test it as a table across every
probability label, several dragon levels and boards with and without encrypted
ads. That table is the regression suite for the whole submission.

## Fixtures are recorded, never written by hand

Hand-written fixtures would assert _our reading_ of the upstream API rather than
the API itself — the exact mistake this project exists to avoid, given that the
published docs are wrong in six separate ways.

`apps/api/test/fixtures/` holds every response of one live game (`xuRILCk8`,
2026-11-23), stored verbatim: both HTML error bodies in full, the `410 Game
Over` transition, a failed purchase, and boards with `encrypted: 2` ads. The
contract tests replay them through `test/support/replay-fetch.ts`, which serves
a path's recordings in the order they were made and refuses once they run out.

The tool that recorded them was deleted once the fixtures existed; the upstream
is a fixed game, so re-recording is not routine. It is in the history at
`47c7ace` (`apps/api/src/tools/capture.ts` and
`src/adapters/mugloar-api-adapter/recorder.ts`) should the upstream ever change.
Never patch a fixture by hand to make a test pass — re-record instead.

## Stubbing the upstream

- **Above the adapter** (managers, bot, benchmark), spy on the repositories'
  `mugloar` objects. `test/support/scripted-game.ts` (`scriptGame`) installs a
  whole fake game that way, and `vi.restoreAllMocks()` removes it.
- **The adapter itself** is tested over real HTTP against a stub server
  (`pointAdapterAt({ baseUrl })` stubs `MUGLOAR_BASE_URL`), or by replaying
  fixtures through `vi.stubGlobal('fetch', createReplayFetch(...))`.
- `vitest.config.ts` gives every project fast adapter settings and an
  unreachable base URL, so a test that forgets to stub cannot reach the live API.

## Benchmark

```bash
pnpm bench          # 20 cold runs — calibration scoped to this benchmark's games
pnpm bench --warm   # same, keeping accumulated history
```

Reports the score distribution, pass rate against 1000, and mean turns survived.

**Cold is the headline number**, because an empty store is what a reviewer gets
on their first `docker compose up`. Cold reads only the evidence of the current
benchmark's own games, so no history is ever deleted, and the concurrent games
learn from each other as they go. The warm figure shows what the learning is
worth. Both go in the README.

**Acceptance: ≥ 95% of cold runs clear 1000.**

Phase 1 benchmarks `baseline` and `calibrated` over the same run count. If the
simple strategy already clears the bar, that result is published rather than
buried.

## CI

CI runs unit, integration, contract, API, component and E2E.

**CI never touches the live API.** The benchmark is a manual command — it plays
hundreds of real games and its results depend on a remote service, so it can
neither be fast nor deterministic.

## Before asking for approval

```bash
pnpm lint && pnpm format && pnpm typecheck && pnpm test
```

Docker runtime is Colima. Integration tests spin up MySQL; container failures
usually mean Colima isn't running — check `colima status`.
