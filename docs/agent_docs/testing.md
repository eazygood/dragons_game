# Testing

## Levels

| Level       | Tool                      | Covers                                                                                           |
| ----------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| Unit        | Vitest                    | Engine (table-driven across labels, levels, boards), decoders, EV maths, calibration             |
| Integration | Vitest + MySQL container  | Repositories, migrations, manager transactions                                                   |
| Contract    | Vitest + mock server      | Adapter against **recorded** fixtures: HTML errors, `410`, both encryption modes                 |
| API         | Vitest + `fastify.inject` | Routes, schemas, error mapping (`test/integration/game-routes.test.ts`, `test/unit/app.test.ts`) |
| Component   | Vitest + Testing Library  | `apps/web/test/`: the API client, retry policy, routing, every play-view state                   |
| E2E         | Playwright                | The built web app with `/api` intercepted in the browser, 3 browsers × 2 widths (360, 1280)      |
| Benchmark   | CLI, manual               | 20 live runs, pass rate against 1000                                                             |

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
published docs are wrong in eight separate ways.

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

Two specs:

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

Latest cold run, 2026-11-24 (20 runs, `calibrated`, tuned defaults): **95% (19
of 20) at 1000 or more**; score min 955, median 2723.5, max 3993; mean 107.6
turns. The score target, `TARGET_SCORE` (1000), lives in `packages/contracts`
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
