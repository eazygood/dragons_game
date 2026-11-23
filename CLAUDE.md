# Dragons of Mugloar

Fullstack solution to the Bigbank test task. A Fastify API owns the only client
to `dragonsofmugloar.com`, runs a decision engine that plays the game, and serves
a React app that lets a human play with the engine's advice.

Read [`docs/agent_docs/architecture.md`](docs/agent_docs/architecture.md) before
changing code.

## Commands

```bash
pnpm dev                # api + web, watch mode
pnpm lint               # eslint, zero warnings tolerated
pnpm format             # prettier
pnpm typecheck          # tsc --noEmit, all workspaces
pnpm test               # unit + component
pnpm test:integration   # needs MySQL (docker compose up -d mysql)
pnpm test:e2e           # Playwright, 3 browsers
pnpm build

pnpm db:migrate         # knex latest
pnpm db:make <name>     # new migration

pnpm bot                # one headless run
pnpm bench              # 20 cold runs, reports pass rate vs 1000
pnpm bench --warm       # same, without truncating calibration
pnpm capture            # record live API responses into test fixtures
```

Docker runtime is Colima. If containers fail, check `colima status`.

## Architecture

**Data flow:** Routes → Mediators → Managers → Repositories → Adapters.
Dependencies move downward only. Never skip a layer, never call upward.

The **decision engine** (`apps/api/src/domain/engine/`) is **pure** — no I/O, no
clock, no randomness. This is load-bearing, not stylistic: it is why the headless
bot and the human player's advisor cannot disagree, and why the strategy is
testable without a network or a database.

```
decide(state, board, calibration) → Decision
```

The bot executes the `Decision`. The UI renders it. Same function.

## Critical rules

- **The published API docs are wrong.** `docs/agent_docs/architecture.md` §API
  is ground truth. `/messages` returns a bare array, `reward` is a number,
  `shoppingSuccess` is a boolean, errors are HTML, and `probability` and
  `encrypted` are undocumented.
- **Encrypted `adId` must be decoded before use in the solve URL.** Sending the
  encoded one is a 400.
- **`410 Game Over` is a terminal domain state, not an error.** Never throw it.
- **A failed purchase still burns a turn.** Never speculatively buy.
- **Never assume a JSON body on a non-2xx response** — the upstream returns HTML.
- **Never retry `solve` or `buy`** — they are not idempotent. Retry reads only.
- **`solve` does not return `level`.** Dragon level is derived locally from
  purchases and must be persisted in the same transaction as the purchase.
- **Object destructuring** for all function arguments: `{ context, gameId }`.
- **CRUD naming:** `createOne`, `findMany`, `updateOne`, `deleteMany`.
- **Guard clauses** over `else if` — return early.
- **Let errors bubble** to the registered Fastify handler; routes never catch.
- **No magic numbers** — strategy thresholds live in one typed `StrategyConfig`.
- Files ≤ 200 lines, preferably ≤ 150. Functions well under 150.
- Run `pnpm lint && pnpm format && pnpm typecheck && pnpm test` before asking for
  approval to commit.

## Validation — three boundaries

1. **User input → client** — UX only (feedback, disabled controls).
2. **Client → API** — Fastify schema on every route. **The server never trusts
   the client**; it re-validates regardless.
3. **API → client** — **parse every response with its contract schema** in the
   query function, before it reaches a component.

Use the same zod schemas from `packages/contracts` on both sides. One
definition. A rule that drifts is worse than no rule. Detail in
[`frontend.md`](docs/agent_docs/frontend.md).

## Frontend rules

- Components ≤ 150–200 lines; split into children beyond that.
- JSX ≤ 50 lines per component.
- **Maximum 3 props per component** — group related values into one typed object.
- No unused props. No hardcoded values; use constants.
- Server state belongs to TanStack Query. There is no client store, because no
  state exists that isn't derived from the server.
- `useEffect` only where genuinely unavoidable.
- Styles colocated with components over a shared stylesheet.
- Comments explain *why*, never *what*, maximum 3 lines.

## Delivery

- All work happens in `.worktrees/` (gitignored).
- Branch and commit prefix: `DRGN-<n>_<short_text>`, 5 words or fewer.
- Default branch is `master`, not `main`.
- **Never run `git add`, `git commit` or `git push` without an explicit request.**
- Use the `gh` CLI for all GitHub operations.

## Agent docs

| Document | Content |
| --- | --- |
| [`architecture.md`](docs/agent_docs/architecture.md) | Layers, verified API reference, decision engine, diagrams |
| [`database.md`](docs/agent_docs/database.md) | Schema, knex patterns, migrations, transactions |
| [`routes.md`](docs/agent_docs/routes.md) | Route organisation, schemas, error mapping, SSE |
| [`frontend.md`](docs/agent_docs/frontend.md) | State management, validation boundaries, error states, component rules |
| [`testing.md`](docs/agent_docs/testing.md) | Test levels, fixtures, recording harness, benchmark |

Working design notes live in `docs/superpowers/` and are gitignored.
