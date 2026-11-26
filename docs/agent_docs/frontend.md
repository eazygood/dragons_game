# Frontend

React 19 + TypeScript + TanStack Router + TanStack Query + Vite.

## State management

TanStack Query owns **all** server state — game state, ad board, shop, the move
log. A bot game's progress is server state too: the page polls it. The route
holds the game id; local `useState` covers only ephemeral UI (the resume-form
draft, the _Show moves_ checkbox, the last move's feedback line). Nothing is
updated optimistically: every value on screen is a server answer.

There is no Redux or Zustand store, and that is a decision rather than an
omission: no state exists in this app that isn't derived from the server. Adding
a client store would create a second copy of the game state that can disagree
with the first — exactly the bug the "everything through Fastify" architecture
exists to prevent.

Query keys are derived from `gameId`, so a solve or a purchase invalidates the
board and the game state together. **Turn-advancing mutations invalidate the
board**, because every turn decrements `expiresIn` on every ad — stale ads are
not a cosmetic problem, they produce `400`s.

| Key (`api/game-queries.ts`)    | Value                       | Fetches                        |
| ------------------------------ | --------------------------- | ------------------------------ |
| `gameKeys.all(gameId)`         | `['game', gameId]`          | (prefix, for invalidation)     |
| `gameKeys.game(gameId)`        | `['game', gameId, 'view']`  | `GET /api/games/:gameId`       |
| `gameKeys.turn(gameId)`        | `['game', gameId, 'turn']`  | `GET /api/games/:gameId/turn`  |
| `gameKeys.moveHistory(gameId)` | `['game', gameId, 'moves']` | `GET /api/games/:gameId/moves` |

Hooks: `useGame`, `useWatchedGame`, `useTurnView`, `useMoveHistory` (queries,
`api/game-queries.ts`); `useStartGame`, `useStartBotGame`, `useSubmitMove`
(mutations, `api/game-mutations.ts`).

- **Cache seeding.** `useStartGame` and `useStartBotGame` write the returned
  `GameView` into `gameKeys.game` before navigating, so the next screen renders
  without a second request. `useSubmitMove` writes `MoveResult.game` into the
  same key in `onSuccess`.
- Moves invalidate `gameKeys.all` in `onSettled`, not `onSuccess`: a failed
  move can still have burnt a turn, and the board must be refetched either way.
- `createQueryClient()` (`src/query-client.ts`) owns the retry policy. Reads
  retry at most twice, and only on `unreachable` or a 5xx. Mutations never
  retry, because `solve` and `buy` are not idempotent. Both run with
  `networkMode: 'always'`: Query's default pauses while the browser reports
  offline, which would show "Loading" forever and replay a queued solve or buy
  on reconnect.
- Every request has a `REQUEST_TIMEOUT_MS` (20 s) timeout in `api/client.ts`,
  so a hung solve or buy cannot leave the buttons disabled. It stays armed
  until the body is read. A timeout surfaces as `unreachable`. The client
  builds it from `setTimeout` and its own `AbortController` rather than
  `AbortSignal.timeout` and `AbortSignal.any`, which are newer than the
  supported browsers and are not polyfilled by the build.
- **Cancellation is not a failure.** When Query aborts a request (the
  component unmounted, the key changed), the abort is rethrown as is, so it is
  never reported as `unreachable`.
- **Game over from the board.** `useTurnView`'s query function catches a
  `410 game_over`, invalidates `gameKeys.game(gameId)` and rethrows.
  `GET /api/games/:gameId` never answers 410, so the refetch returns the
  finished game and the screen switches to the end screen.
- **One last moves fetch.** The query function behind `useGame` and
  `useWatchedGame` invalidates `gameKeys.moveHistory(gameId)` whenever the game
  comes back with a status other than `active`. The game and moves polls run on
  independent timers, so without this the moves made since the previous tick
  would never be shown once polling stops. It costs one extra request.

### Polling

`/watch` is the only place that polls, and it polls **only while the game is
`active`**. Both intervals live in `api/poll-intervals.ts`.

- `useWatchedGame` shares its key with `useGame`. Its `refetchInterval` is a
  function of the last response: `WATCH_POLL_INTERVAL_MS` (1000 ms) while
  `status === 'active'`, `false` otherwise. Polling stops by itself on
  `game_over` or `abandoned`, and nothing has to be unsubscribed.
- `useMoveHistory` lives in `MoveLog`, which is mounted only while _Show moves_
  is checked, and polls every `MOVE_HISTORY_POLL_INTERVAL_MS` (2500 ms) while
  the game is active. The list grows by one row a turn and is the heavier
  response, so it does not need the status bar's rate. A viewer who never
  opens the log never sends a moves request.
- The rule reads only `status`, so a manual game opened at `/watch` is polled and
  stopped the same way.
- Polling is cheap on the server. Both routes read the database only (the bot
  loop owns the upstream), and the throttle never sees them. They are still
  rate limited per client (300 a minute), well above what one open tab sends.

## Layout

```
apps/web/
├── src/
│   ├── api/                 - api-error, client (apiRequest), game-paths, game-queries, game-mutations,
│   │                          game-status (hasActiveStatus), poll-intervals
│   ├── features/play/
│   │   ├── play-copy.ts     - every user-facing string on /play
│   │   ├── start/           - StartGamePanel (new game, let the bot play), ResumeGameForm
│   │   ├── game/            - GameScreen, ActiveGame, GameOverScreen
│   │   ├── board/           - AdBoard, AdCard, AdviceBadge
│   │   ├── advice/          - RecommendationBanner
│   │   ├── shop/            - ShopPanel, ShopItemRow
│   │   └── move-actions/    - useMoveActions, move-actions, MoveFeedback
│   ├── features/watch/      - WatchScreen, WatchOutcome, RunBotAgainButton, MoveLog, MoveLine,
│   │                          keyed-moves, watch-outcome, watch-copy
│   ├── shared/              - used by both features: GameIdGate, GameStatusBar, GameUnavailable,
│   │                          ErrorNotice, error-copy, RefreshHint, RouteFallbacks, Panel,
│   │                          launch-lock, focus-on-mount, format, page-head, shared-copy
│   ├── routes/              - file routes: / → /play, /play, /play/$gameId, /watch/$gameId
│   ├── router.tsx           - router with the not-found and error fallbacks
│   ├── zod-config.ts        - zod jitless mode; imported first by main.tsx
│   ├── main.tsx             - providers
│   ├── query-client.ts
│   └── styles/tokens.css    - palette, spacing, the `:focus-visible` ring
├── public/favicon.svg
├── e2e/                     - Playwright specs and their intercepted-API helpers
└── test/                    - all web tests, plus stubApi, fixtures and render helpers
```

Each component's styles sit next to it as a `*.module.css` file; `tokens.css`
is the only global stylesheet.

`routeTree.gen.ts` is generated by the router plugin and committed, because
`tsc --noEmit` needs it before any Vite run. Lint and Prettier ignore it.

## The watch view

`/watch/$gameId` follows one game, normally a bot's. The start screen's _Let the
bot play_ button calls `POST /api/bot-games` and navigates there.

- **Status bar and outcome.** The shared `GameStatusBar` shows score, gold, lives,
  dragon level and turn. Below it, `WatchOutcome` shows the score against
  `TARGET_SCORE` (1000, from `packages/contracts`, shared with `pnpm bench`).
- **One outcome, keyed on score alone.** While `active` the line is "In progress…".
  Once the status is anything else, it reads "Reached 1000 ✓ — final score N" when
  `score >= TARGET_SCORE`, and "Finished at N" otherwise. `game_over` and
  `abandoned` are not told apart: the common bot ending is `abandoned` (the engine
  stops when no ad is worth taking) with a score far above 1000, so a copy keyed
  on status would call the usual success a failure. The neutral wording also keeps
  a manual game opened here from being labelled as the bot's. `GameView` carries
  no strategy and is unchanged.
- **Show moves.** A checkbox, unchecked by default, held in `useState` and
  therefore reset on reload. There is no URL parameter and no store. Checking it
  enables `useMoveHistory`.
- **Move log.** Newest first, in the order the API returns them, one line per
  move, for example:
  - `Turn 14 · Solved a “Quite likely” ad for 45 gold · best value, est. 78%, EV +31 gold · ✓`
  - `Turn 15 · Bought Healing potion · keep lives safe · ✓`

  The wording of each `DecisionRule` lives in `watch-copy.ts`
  (`satisfies Record<DecisionRule, string>`, so a new rule fails typecheck until
  it has copy). A `null` rule or `null` item name drops that part of the line
  rather than showing a placeholder. A failed refresh keeps the last good list.

- **Finished.** A link to "Play a game yourself" (`/play`) and a "Run the bot again"
  button. The button calls `POST /api/bot-games` through `useStartBotGame`, locks while
  the request is pending or has succeeded, and navigates to the new game's
  `/watch/$gameId`. The route keys `WatchScreen` on the game id, so _Show moves_
  starts unchecked on the new game.
- **Unusable ids.** The route wraps the screen in `GameIdGate`, which checks the
  id with `GameIdSchema` before any request (`invalid_id`). An unknown game is
  `not_found`. Both reuse `GameUnavailable`.

A bot's game opened at `/play/$gameId` answers `409` on its turn query. That
renders "The bot's game" with a link to `/watch/$gameId` next to the way back.

---

## Validation

The brief names input validation explicitly, so it is first-class. There are
**three** boundaries, and they do different jobs.

### 1. User input → client

For UX only: immediate feedback and disabled controls. It never substitutes for
the server's checks, and deleting it must not change what the API accepts.

The app has few real inputs — most interactions are clicks on server-supplied
ids, which need no validation because the user never typed them. Validate the
ones that are genuinely free-form:

| Input                    | Where                             | Rule                                                                                                                                                                                                                                                                             |
| ------------------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gameId` to resume a run | `/play` (`ResumeGameForm`)        | **The important one.** Free text that ends up in an outbound URL path. `GameIdSchema` checks shape and length; the message quotes `IDENTIFIER_MAX_LENGTH` (64) from contracts, so the copy cannot drift from the rule. Invalid input sets `aria-invalid` and `aria-describedby`. |
| `gameId` in the URL      | `/play/$gameId`, `/watch/$gameId` | Hand-editable, so `GameIdGate` applies the same `GameIdSchema` check before any request. A bad id renders `GameUnavailable`, not a failed request.                                                                                                                               |

Nothing else is typed: the start buttons and the _Show moves_ checkbox carry no
data.

Validate with the **same zod schemas** from `packages/contracts` that the API
uses. One definition, both sides — a rule that drifts is worse than no rule.

### 2. Client → API

Covered by Fastify schemas on every route. See [`routes.md`](routes.md). The
server re-validates everything regardless of what the client checked.

### 3. API → client _(the one most often skipped)_

**Parse every API response with its contract schema at the boundary**, in the
query function, before it reaches a component.

This is not ceremony. The upstream API is wrong in eight documented ways (see
[`architecture.md`](architecture.md)), which is proof that assumed response
shapes are a real failure mode here. Parsing at the boundary turns contract drift
into one clear error next to the request that caused it, instead of a
`cannot read property of undefined` three components deep.

A failed parse is an application error, surfaced through the same error path as
any other — not a silent fallback to empty state.

---

## Error states

Every domain error in [`routes.md`](routes.md) has a designed treatment. These
are UI work, not `catch` blocks. `ERROR_COPY` (`shared/error-copy.ts`) maps every
`ClientErrorCode` to a message with `satisfies Record<ClientErrorCode, string>`,
so a new code fails typecheck until it has copy.

| State                                       | Treatment                                                                                                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GameOver` (`410`)                          | `GameOverScreen` with the final score and a "new game" action; focus moves to its heading. Not a toast.                                               |
| `GameNotFound` (`404`)                      | `GameUnavailable` "No such game" with a way back to the start. No retry.                                                                              |
| `404` on the turn query                     | The game is stored but the upstream has forgotten it: `GameUnavailable` "This game has expired on the game server" with "Start a new game". No retry. |
| `GameNotPlayable` (`409` on the turn query) | `GameUnavailable` "The bot's game" with a link to watch it, and a way back. No retry.                                                                 |
| `AdExpired` (`409` on a solve)              | The board is refetched and `MoveFeedback` says the ad expired before you got to it.                                                                   |
| `409` on a buy                              | `MoveFeedback` says the purchase was refused; the board and gold are refetched.                                                                       |
| `InsufficientGold`                          | `ShopItemRow` is disabled with the reason linked by `aria-describedby`, visible _before_ the click.                                                   |
| `too_many_requests` (`429`)                 | "Too many requests in a short time. Wait a moment, then try again."                                                                                   |
| `service_unavailable` (`503`)               | "The game service is temporarily unavailable. Try again in a moment." Sent while the server shuts down.                                               |
| `upstream_unavailable` (`502`)              | "The game is safe, but the Mugloar server is not answering." with a retry. A non-JSON 502/503/504 from a proxy maps here too.                         |
| `unreachable` (status 0)                    | The API itself did not answer: network failure, the browser offline, or the 20 s timeout. "Cannot reach the game server…" with a retry.               |
| Response parse failure                      | `invalid_response`: generic error with a retry; the zod issues are logged to the console.                                                             |
| Failed background refresh                   | The last good state stays on screen with "Could not refresh the game. Showing the last known state." (`role="status"`).                               |
| Unknown route                               | Router `defaultNotFoundComponent`: `NotFoundScreen` with a link to `/play`.                                                                           |
| Error thrown while rendering a route        | Router `defaultErrorComponent`: `RouteErrorScreen` renders `ErrorNotice` with the router's `reset` as retry.                                          |

Only a first load fails hard (`isLoadingError` → `ErrorNotice` with Retry). A
refetch error (`isRefetchError`) keeps the last good data; on `/watch` the next
poll replaces it. A game in progress must survive a transient failure. Losing a
run to a dropped request is the worst outcome in this app.

---

## Component rules

- Components ≤ 150–200 lines; split into children beyond that.
- JSX ≤ 50 lines per component.
- **Maximum 3 props per component** — group related values into one typed object
  rather than widening the signature.
- No unused props. No hardcoded values; use constants.
- `useEffect` only where genuinely unavoidable. Server state is Query's job;
  derived values are computed during render, not synced in an effect.
- Styles colocated with components over a shared stylesheet.
- Comments explain _why_, never _what_, maximum 3 lines.
- Naming is self-explanatory — if a variable needs a comment to be understood,
  rename it instead.
- Zero linter errors.

## Responsiveness and browsers

Explicit brief requirements, so they are verified rather than assumed: one
responsive layout from ~360px upward, exercised by Playwright across Chromium,
Firefox and WebKit at 360px, 768px and 1280px. Each flow ends by asserting that the page
does not scroll horizontally at the width it ran in. See [`testing.md`](testing.md).

## Accessibility

Not in the brief, cheap here. What the code does:

- Native controls only: ads and shop items are `<button>`s, so selection is
  keyboard-operable with no key handlers. An ad that cannot be attempted and an
  unaffordable item are `disabled`, with the reason linked by `aria-describedby`.
- Announcements: loading text, the move feedback, the watch outcome and the
  stale-refresh hint are `role="status"`; `ErrorNotice` and the start and
  run-again errors are `role="alert"`.
- Focus: after a move, focus moves to the `MoveFeedback` region (`tabIndex={-1}`);
  `GameOverScreen` focuses its heading via the `focusOnMount` callback ref.
  `:focus-visible` rings are defined in `styles/tokens.css`.
- Landmarks and labels: the board, shop, recommendation and `Panel` sections are
  `aria-labelledby` their headings; `GameStatusBar` is a labelled `role="group"`;
  the move log is a labelled `<ol>`, and a move's ✓/✗ mark is `role="img"` with
  an `aria-label`, so the result is not carried by colour or glyph alone.
- Not automated: `eslint-plugin-jsx-a11y` does not support ESLint 10 yet, so
  there is no a11y lint rule.

## Content Security Policy

The API serves the app with a helmet CSP that forbids `eval`. zod 4 probes for
eval support with `new Function` on first parse, which would log a CSP violation
on every page load. `src/zod-config.ts` calls `z.config({ jitless: true })`
and is the first import in `main.tsx`, so it runs before any module builds a
schema.

Import order alone is not enough in the build: the entry chunk would run after
the shared chunk that builds the contract schemas. `vite.config.ts` sets
`strictExecutionOrder` so the bundle keeps the source order.
`zod-config.test.ts` covers the setting.

`vite preview`, which the e2e tests run against, sends a copy of the API's
policy. Keep it in sync with `apps/api/src/plugins/security-headers.ts`: a
looser preview policy would let e2e pass on code the real server blocks.
