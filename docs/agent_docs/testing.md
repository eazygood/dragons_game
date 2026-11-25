# Testing

## Levels

| Level       | Tool                      | Where                        | Tests | Covers                                                                                              |
| ----------- | ------------------------- | ---------------------------- | ----- | --------------------------------------------------------------------------------------------------- |
| Contracts   | Vitest                    | `packages/contracts/test/`   | 28    | Shared zod schemas, move shapes, probability labels                                                 |
| Unit        | Vitest                    | `apps/api/test/unit/`        | 238¹  | Engine (table-driven), decoders, EV maths, calibration, adapter, config, app hardening              |
| Contract    | Vitest + recorded replay  | `apps/api/test/contract/`    | (¹)   | Adapter and repositories against **recorded** responses: boards, moves, HTML errors, `410`          |
| Integration | Vitest + MySQL container  | `apps/api/test/integration/` | 92    | Repositories, migrations, manager transactions, routes, bot runs, shutdown, rate limits             |
| API         | Vitest + `fastify.inject` | unit and integration         | —     | Routes, schemas, error mapping (`game-routes.test.ts`, `app.test.ts`, `security-hardening.test.ts`) |
| Component   | Vitest + Testing Library  | `apps/web/test/`             | 107   | The API client, retry policy, routing, every play and watch state                                   |
| E2E         | Playwright                | `apps/web/e2e/`              | 18²   | The built web app with `/api` intercepted in the browser                                            |
| Benchmark   | CLI, manual               | `apps/api/src/cli/bench.ts`  | —     | 20 live runs, pass rate against 1000                                                                |

¹ The api `unit` and `contract` Vitest projects run together under `pnpm test`;
238 is their combined count. ² 3 tests × 6 projects (3 browsers × 2 widths).
Counts as of 2026-11-25; `pnpm test` runs contracts, api unit + contract and
web, and integration and E2E have their own scripts.

The engine being **pure** is what makes the most important tests fast and
deterministic — no network, no database, no clock.

## What to assert

Pin the behaviour the brief cares about, not the implementation. A refactor must
not break a test. If a test knows which function called which, it is testing the
wrong thing.

The engine is the exception worth effort, and it has two regression suites:

- `test/unit/decide-table.test.ts` — every probability label × a dragon level in
  each calibration bucket, on plaintext and encrypted boards, with every label
  measured as a failure in the top bucket only, so the level decides whether the
  prior or the measurement prices the ad.
- `test/unit/decide-boundaries.test.ts` — the shipped strategy at its edges: the
  survival floor and the tie-break between equally safe ads.

Both derive their expectations from `STRATEGY_CONFIG` rather than literals, so a
retune moves the thresholds without rewriting the tests. They, and the web
fixtures, take the shop from `RECORDED_SHOP_ITEMS`, exported by contracts as
`@bigbank-dragon/contracts/test-support` (`packages/contracts/test/support/shop-items.ts`).

## Fixtures are recorded, never written by hand

Hand-written fixtures would assert _our reading_ of the upstream API rather than
the API itself — the exact mistake this project exists to avoid, given that the
published docs are wrong in eight separate ways.

`apps/api/test/fixtures/` holds every response of one live game (`xuRILCk8`,
2026-11-23), stored verbatim: both HTML error bodies in full, the `410 Game
Over` transition, a failed purchase, and boards with `encrypted: 1` (base64) and
`encrypted: 2` (ROT13) ads. `test/support/replay-fetch.ts` serves a path's
recordings in the order they were made and throws once they run out.
`test/support/recorded-game.ts` (`startReplay`) points the adapter at a
`replay.invalid` base URL and stubs `fetch` with a fresh replay.

- `test/contract/recorded-boards.test.ts` parses every recorded board through
  `adRepository` without dropping an ad, decodes every base64 `adId` into one
  `SolveParamsSchema` accepts, decodes the ROT13 ads to known labels, and reads
  the final `410` as `game_over`.
- `test/contract/recorded-moves.test.ts` replays the game start, every solve
  (the game-ending one included), the HTML `404` and `400` bodies (the latter as
  `AdExpiredError`) and the failed purchase through the repositories.

The tool that recorded them was deleted once the fixtures existed; the upstream
is a fixed game, so re-recording is not routine. It is in the git history at
commit 47c7ace should the upstream ever change. Never patch a fixture by hand to
make a test pass — re-record instead.

## Stubbing the upstream

- **Above the adapter** (managers, bot, benchmark), spy on the repositories'
  `mugloar` objects. `test/support/scripted-game.ts` (`scriptGame`) installs a
  whole fake game that way, and `vi.restoreAllMocks()` removes it.
- **The adapter itself** is tested over real HTTP against a stub server
  (`test/support/stub-server.ts`; `failTimes` scripts transient failures for the
  retry tests), or by replaying fixtures (`startReplay`).
  `pointAdapterAt({ baseUrl, overrides })` (`test/support/mugloar-api.ts`) calls
  `configureMugloarApi` with the test config aimed at that URL, which also builds
  a fresh token bucket.
- `vitest.config.ts` gives every project fast adapter settings (200 ms timeout,
  1000 req/s) and the unreachable base URL `http://127.0.0.1:1`, so a test that
  forgets to stub cannot reach the live API.

## Stubbing the API in web tests

Web tests never reach Fastify. `apps/web/test/fetch-stub.ts` replaces `fetch`:

- `stubApi(routes)` takes keys of the form `'METHOD /path'`, built from the real
  `gamePaths`, for example `'GET /api/games/g1/turn'`. A request with no key
  rejects, so the test fails loudly instead of hanging. It returns the stub,
  and `callCountOf(key)` counts the requests to one route.
- Responders: `respondOk({ body })`, `respondWith({ status, body })`,
  `respondNever()` for an in-flight move, and `respondInSequence({ responders })`
  for a game that changes between fetches.
- `renderWithQuery(ui)` gives a fresh no-retry query client. `renderInRouter(ui)`
  also mounts a memory router for components that render `<Link>`. Pass
  `{ queryClient: createQueryClient() }` to either one to test the production
  retry and game-over policy.
- `vitest.config.ts` sets `unstubGlobals: true`, so each test starts with the
  real `fetch` again.

## E2E

```bash
pnpm test:e2e                                           # from the repo root
pnpm --filter @bigbank-dragon/web exec playwright install   # once, to fetch the browsers
```

`apps/web/playwright.config.ts` builds the web app and serves the **production
bundle** with `vite preview` on `127.0.0.1:4173`, because the build is what ships.
No API, database or upstream is started. There are six projects: Chromium,
Firefox and WebKit, each at a phone width (360 × 740) and a desktop width
(1280 × 800).

Every `/api` request is **intercepted in the browser**, so what is tested is the
layout and behaviour of the UI, not game correctness (that is `pnpm bench`).

- `e2e/api-fixtures.ts` builds each response with the contract's own zod schema
  (`GameViewSchema.parse`, `TurnViewSchema.parse`, `MoveListSchema.parse`), so a
  fixture that drifts from the contract fails when the spec loads. `routeApi({
page, routes })` takes keys of the form `'METHOD /path'`, built from the real
  `gamePaths`, and each responder returns the JSON of a `200`.
- `e2e/guarded-test.ts` is the `test` every spec imports. It first installs a
  **deny-all** route on `**/api/**` that aborts and records the request; `routeApi`
  layers on top and falls back to it for anything it does not script. After the
  spec, any recorded request fails the test, so a request nobody scripted cannot
  pass unnoticed.
- `e2e/layout.ts` (`expectNoHorizontalOverflow`) is called at the end of each
  flow, so the 360px projects fail on a layout that scrolls sideways.

Two specs, three tests:

1. `play.spec.ts` — start a game, see the engine's advice, solve the recommended
   ad, see the score move.
2. `watch.spec.ts` — press _Let the bot play_, land on `/watch/:gameId` "In
   progress…", let the scripted game become `abandoned` with a score of 1240, see
   "Reached 1000 ✓", tick _Show moves_ and read the move log. The game flips state
   when the spec says so, not after a request count, because the page may refetch
   on focus and consume a scripted step early. A second test presses _Run the bot
   again_ on the finished game and lands on the new game's `/watch` view.

The component tests under `apps/web/test/` cover the states the E2E does not (every
error treatment, retry policy, the polling rule).

## Benchmark

```bash
pnpm bench          # 20 cold runs — calibration scoped to this benchmark's games
pnpm bench --warm   # same, keeping accumulated history
```

Three cold runs of the same tuned `STRATEGY_CONFIG` (20 runs each, `calibrated`):

| Date       | At 1000 or more | Score min · median · max | Mean turns |
| ---------- | --------------- | ------------------------ | ---------- |
| 2026-11-23 | 100% (20/20)    | 1566 · 2687 · 3576       | 101.2      |
| 2026-11-24 | 95% (19/20)     | 955 · 2723.5 · 3993      | 107.6      |
| 2026-11-25 | 100% (20/20)    | 1794 · 2503.5 · 3361     | 108.5      |

History in [`findings/phase-1-benchmark.md`](findings/phase-1-benchmark.md).

The score target, `TARGET_SCORE` (1000), lives in `packages/contracts`
and is shared with the web app's "Reached 1000" line.

Reports the score distribution, pass rate against 1000, and mean turns survived.

**Cold is the headline number**, because an empty store is what a reviewer gets
on their first `docker compose up`. Cold reads only the evidence of the current
benchmark's own games, so no history is ever deleted, and the concurrent games
learn from each other as they go. The warm figure shows what the learning is
worth. The README quotes the cold number.

**Acceptance: ≥ 95% of cold runs clear 1000.**

Phase 1 benchmarks `baseline` and `calibrated` over the same run count. If the
simple strategy already clears the bar, that result is published rather than
buried.

## CI

There is no CI configuration in the repository; the suites run locally. If one is
added, it should run unit, integration, contract, API, component and E2E.

**Nothing but the benchmark touches the live API**, and a CI job must never run
it. The benchmark is a manual command — it plays hundreds of real games and its
results depend on a remote service, so it can neither be fast nor deterministic.

## Before asking for approval

```bash
pnpm lint && pnpm format && pnpm typecheck && pnpm test
```

`pnpm format:check` is the read-only form of `pnpm format`. Run
`pnpm test:integration` too when the change touches the database, and
`pnpm test:e2e` when it touches the web app's behaviour or layout.

Docker runtime is Colima. Integration tests spin up MySQL; container failures
usually mean Colima isn't running — check `colima status`.
