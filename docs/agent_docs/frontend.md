# Frontend

React 19 + TypeScript + TanStack Router + TanStack Query + Vite.

## State management

TanStack Query owns **all** server state — game state, ad board, shop, bot
stream, history. Local `useState` covers only ephemeral UI: open dialogs,
selected ad, form drafts.

There is no Redux or Zustand store, and that is a decision rather than an
omission: no state exists in this app that isn't derived from the server. Adding
a client store would create a second copy of the game state that can disagree
with the first — exactly the bug the "everything through Fastify" architecture
exists to prevent.

Query keys are derived from `gameId`, so a solve or a purchase invalidates the
board and the game state together. **Turn-advancing mutations invalidate the
board**, because every turn decrements `expiresIn` on every ad — stale ads are
not a cosmetic problem, they produce `400`s.

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

| Input                       | Where                | Rule                                                                                                                                           |
| --------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `gameId` to resume a run    | `/play`              | **The important one.** Free text that ends up in an outbound URL path. Validate shape and length, reject anything else, never interpolate raw. |
| Bot run config              | `/watch`             | Strategy is a closed set; run count is a bounded integer.                                                                                      |
| History filters, pagination | `/history`, `/stats` | Bounded ranges; reject negative or absurd page sizes.                                                                                          |

Validate with the **same zod schemas** from `packages/contracts` that the API
uses. One definition, both sides — a rule that drifts is worse than no rule.

### 2. Client → API

Covered by Fastify schemas on every route. See [`routes.md`](routes.md). The
server re-validates everything regardless of what the client checked.

### 3. API → client _(the one most often skipped)_

**Parse every API response with its contract schema at the boundary**, in the
query function, before it reaches a component.

This is not ceremony. The upstream API is wrong in six documented ways (see
[`architecture.md`](architecture.md)), which is proof that assumed response
shapes are a real failure mode here. Parsing at the boundary turns contract drift
into one clear error next to the request that caused it, instead of a
`cannot read property of undefined` three components deep.

A failed parse is an application error, surfaced through the same error path as
any other — not a silent fallback to empty state.

---

## Error states

Every domain error in [`routes.md`](routes.md) has a designed treatment. These
are UI work, not `catch` blocks:

| State                         | Treatment                                                               |
| ----------------------------- | ----------------------------------------------------------------------- |
| `GameOver` (`410`)            | A screen with the final score and a "new game" action. Not a toast.     |
| `AdExpired` (`409`)           | Refresh the board and say why the ad vanished.                          |
| `InsufficientGold` (`409`)    | The buy control is disabled with the reason visible _before_ the click. |
| `UpstreamUnavailable` (`502`) | Retry affordance; make clear the game is intact and the remote is down. |
| Response parse failure        | Generic error with a retry; log the detail.                             |

A game in progress must survive a transient failure. Losing a run to a dropped
request is the worst outcome in this app.

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
Firefox and WebKit at mobile and desktop viewports.

## Accessibility

Not in the brief, cheap here, and reviewers notice: keyboard-operable ad
selection, labelled controls, visible focus, and status changes announced rather
than only shown by colour.
