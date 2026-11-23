# Testing

## Levels

| Level | Tool | Covers |
| --- | --- | --- |
| Unit | Vitest | Engine (table-driven across labels, levels, boards), decoders, EV maths, calibration |
| Integration | Vitest + MySQL container | Repositories, migrations, manager transactions |
| Contract | Vitest + mock server | Adapter against **recorded** fixtures: HTML errors, `410`, both encryption modes |
| API | Vitest + `fastify.inject` | Routes, schemas, error mapping |
| Component | Vitest + Testing Library | Components with three or more states |
| E2E | Playwright | Full game flow against a stubbed upstream, 3 browsers, 2 viewports |
| Benchmark | CLI, manual | 20 live runs, pass rate against 1000 |

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

Hand-written fixtures would assert *our reading* of the upstream API rather than
the API itself — the exact mistake this project exists to avoid, given that the
published docs are wrong in six separate ways.

```bash
pnpm capture
```

The adapter has a record/replay mode that writes every real response verbatim to
`apps/api/test/fixtures/`. A capture session must deliberately hunt the rare
cases:

- an **`encrypted: 2`** ad — never yet observed, and the decoder is unverified
  without one
- both HTML error bodies, **in full** (not truncated)
- the `410 Game Over` transition
- a failed purchase, to confirm it still burns a turn

If a session cannot produce an `encrypted: 2` ad, record that as a finding in
`architecture.md` and escalate it. Do not paper over it with a guess.

## Benchmark

```bash
pnpm bench          # 20 cold runs — truncates calibration first
pnpm bench --warm   # same, keeping accumulated history
```

Reports the score distribution, pass rate against 1000, and mean turns survived.

**Cold is the headline number**, because an empty store is what a reviewer gets
on their first `docker compose up`. The warm figure shows what the learning is
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
