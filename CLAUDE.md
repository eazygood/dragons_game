# Dragons of Mugloar

Fullstack solution to the Bigbank test task. A Fastify API owns the only client
to `dragonsofmugloar.com`, runs a decision engine that plays the game, and serves
a React app that lets a human play with the engine's advice, or watch the bot play.

Read [`docs/agent_docs/architecture.md`](docs/agent_docs/architecture.md) before
changing code.

## Commands

```bash
docker compose up --build   # whole stack on http://localhost:3000
pnpm dev                # api + web, watch mode
pnpm lint               # eslint, zero warnings tolerated
pnpm format             # prettier (format:check is read-only)
pnpm typecheck          # tsc --noEmit, all workspaces
pnpm test               # contracts, api unit + contract, web component
pnpm test:integration   # needs MySQL (docker compose up -d --wait mysql)
pnpm test:e2e           # Playwright, 3 browsers x 3 widths, /api intercepted
pnpm build

pnpm db:migrate         # apps/api/src/migrate.ts: knex latest
pnpm db:make <name>     # new migration in apps/api/migrations

pnpm bot                # apps/api/src/cli/bot.ts: one headless run
pnpm bench              # apps/api/src/cli/bench.ts: 20 cold runs, pass rate vs 1000
pnpm bench --warm       # same, reading all history instead of this run's
```

Docker runtime is Colima. If containers fail, check `colima status`.

## Architecture

**Data flow:** Routes → Mediators → Managers → Repositories → Adapters.
Dependencies move downward only. Never skip a layer, never call upward.
Entry points are `routes/` (HTTP) and `cli/` (bot, bench); both call mediators
or managers only, and `app.ts` and `cli/live-runtime.ts` are the composition
roots. `eslint.boundaries.mjs` enforces the boundaries.

The **decision engine** (`apps/api/src/engine/`) is **pure** — no I/O, no
clock, no randomness. This is load-bearing, not stylistic: it is why the headless
bot and the human player's advisor cannot disagree, and why the strategy is
testable without a network or a database.

```
decide({ state, board, shop, calibration, config }) → Decision
```

The bot executes the `Decision`. The UI renders it. Same function.

## Critical rules

- **The published API docs are wrong.** `docs/agent_docs/architecture.md` §API
  is ground truth. `/messages` and `/shop` return bare arrays, `reward` is a number,
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
- Files ≤ 200 lines, preferably ≤ 150. A manager that outgrows one file becomes a
  folder, one file per concern behind an `index.ts` that callers import
  (`managers/game-manager/`). `bot-manager.ts` is the one exception left.
  Functions well under 150.
- Run `pnpm lint && pnpm format && pnpm typecheck && pnpm test` before asking for
  approval to commit.

## Validation — three boundaries

1. **User input → client** — UX only (feedback, disabled controls).
2. **Client → API** — Fastify schema on every route that takes input. **The server
   never trusts the client**; it re-validates regardless.
3. **API → client** — **parse every response with its contract schema** in the
   query function, before it reaches a component.

Use the same zod schemas from `packages/contracts` on both sides. One
definition. A rule that drifts is worse than no rule. `contracts` holds only
what the API and the web exchange; a schema only the API uses lives beside its
layer (route params in `routes/schemas/`). Detail in
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
- Comments explain _why_, never _what_, maximum 3 lines.

## Delivery

- All work happens in `.worktrees/` (gitignored).
- Branch and commit prefix: `DRGN-<n>_<short_text>`, 5 words or fewer.
- Default branch is `master`, not `main`.
- **Never run `git add`, `git commit` or `git push` without an explicit request.**
- Use the `gh` CLI for all GitHub operations.

## Agent docs

| Document                                             | Content                                                                |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| [`architecture.md`](docs/agent_docs/architecture.md) | Layers, verified API reference, decision engine, diagrams              |
| [`database.md`](docs/agent_docs/database.md)         | Schema, knex patterns, migrations, transactions                        |
| [`routes.md`](docs/agent_docs/routes.md)             | Route organisation, schemas, error mapping, serving the web app        |
| [`frontend.md`](docs/agent_docs/frontend.md)         | State management, validation boundaries, error states, component rules |
| [`testing.md`](docs/agent_docs/testing.md)           | Test levels, recorded fixtures, benchmark                              |

Benchmark history: [`findings/phase-1-benchmark.md`](docs/agent_docs/findings/phase-1-benchmark.md).
Local design notes in `docs/superpowers/` are gitignored and not part of the repo.
