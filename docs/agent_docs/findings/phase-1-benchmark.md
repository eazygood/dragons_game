# Phase 1 benchmark — raw numbers

Every number here came from `pnpm bench` against the live API on 2026-11-23.
Cold runs truncate `ad_attempts` first, so `calibrated` starts from priors and
learns within the invocation (3 games in parallel share the evidence).

## 1. Baseline vs calibrated (before reward bands)

| Strategy     | Runs | Pass ≥ 1000 | Min | Median | Max  | Mean turns |
| ------------ | ---- | ----------- | --- | ------ | ---- | ---------- |
| `baseline`   | 20   | 55%         | 672 | 1224   | 5114 | 63.0       |
| `calibrated` | 20   | 90%         | 722 | 3388   | 5169 | 75.0       |

Calibration is worth 35 points of pass rate. The two failures (970, 722) died
early on easy-labelled, high-reward ads — which led to the next finding.

## 2. The reward trap

Success rate by label and reward, `calibrated` cold, all 20 runs:

| Label           | Reward    | Level | Success      |
| --------------- | --------- | ----- | ------------ |
| `Sure thing`    | < 100     | any   | 47/47        |
| `Sure thing`    | 100 – 159 | any   | 0.50 (n = 6) |
| `Sure thing`    | ≥ 160     | any   | 1/45         |
| `Piece of cake` | 160 – 219 | < 5   | 0.04         |
| `Piece of cake` | 160 – 219 | ≥ 5   | 0.71         |
| `Piece of cake` | ≥ 220     | any   | 0/5 · 0.17   |

`Walk in the park`, `Quite likely`, `Hmmm....` and `Gamble` are roughly flat
across rewards. Fix: calibration keyed on a reward band (edges 100, 160) and
reloaded every turn.

## 3. Must-verify list (spec §10)

| Question                                 | Result                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| `encrypted: 2` is ROT13                  | Yes — fixture `messages-27`: `Vzcbffvoyr` → `Impossible`                                   |
| Decoded `adId` needed for `encrypted: 2` | Yes — probe game: raw id → `400` HTML, ROT13-decoded id → `200`                            |
| Reputation                               | **Burns a turn** per call; values move but nothing uses them. Skipped — a negative result. |
| Rate limiting                            | No `429` in any benchmark (3 concurrent games, several thousand calls)                     |

## 4. Reward bands, then the level-up policy

`calibrated`, cold, 20 runs each, after keying calibration on reward band and
reloading it every turn:

| Level-ups | Pass ≥ 1000 | Min  | Median | Max  | Mean turns |
| --------- | ----------- | ---- | ------ | ---- | ---------- |
| on        | 95%         | 853  | 3348   | 4531 | 77.3       |
| off       | **100%**    | 1028 | 2510   | 3323 | 106.7      |

Reward bands alone moved `calibrated` from 90% to 95%; its one failure was the
first wave of a cold start, learning a fresh trap cell at α = 5. Turning
level-ups off trades the score ceiling for survival: games last about 30 turns
longer and none fell short. Pass rate is the brief's measure, so **level-ups are
off by default**. A plausible cause, not measured: every level-up moves the
dragon into a fresh level bucket, where the engine must relearn the traps.

## 5. Threshold sweep

`calibrated`, cold, level-ups off, **10 runs per point**, one setting changed at
a time from the defaults (`smoothingAlpha` 5, `livesFloor` 2,
`minimumProbability` 0.45, `turnCostInGold` 20):

| Change                    | Pass ≥ 1000 | Min  | Median | Max  | Mean turns |
| ------------------------- | ----------- | ---- | ------ | ---- | ---------- |
| _none (20 runs, from §4)_ | 100%        | 1028 | 2510   | 3323 | 106.7      |
| `smoothingAlpha` 2        | 100%        | 1522 | 2662   | 2901 | 103.5      |
| `smoothingAlpha` 3        | 100%        | 1091 | 2398   | 3336 | 99.0       |
| `livesFloor` 1            | 100%        | 1067 | 2835   | 3306 | 101.2      |
| `livesFloor` 3            | 100%        | 1313 | 2921   | 3189 | 94.4       |
| `minimumProbability` 0.3  | **90%**     | 827  | 2441   | 2932 | 95.4       |
| `minimumProbability` 0.6  | 100%        | 1532 | 2183   | 2949 | 107.3      |
| `turnCostInGold` 0        | 100%        | 1128 | 2862   | 3179 | 91.5       |
| `turnCostInGold` 40       | 100%        | 1061 | 2361   | 3029 | 103.8      |

Only a permissive probability floor costs pass rate. Everything else ties at
100%, so median decides — and with 10 runs a median moves by a few hundred on
noise alone, so these are leanings, not verdicts.

Chosen: **`livesFloor` 3** (best median) and **`smoothingAlpha` 2** (best
minimum, and the direct fix for the one cold-start failure in §4: a 0.95 prior
now drops below the probability floor after 3 failures instead of 6).

`livesFloor` 3 equals the starting lives, so it really means _buy a potion
whenever gold allows_. That is sound: score comes only from rewards, gold has no
value at game end, and lives are the binding constraint — banking gold as lives
costs nothing but the turn.

The two were not swept together; §6 validates the combination.

## 6. Acceptance

`pnpm bench --runs 20` — the shipped defaults, cold:

| Pass ≥ 1000 | Min  | Median | Max  | Mean turns |
| ----------- | ---- | ------ | ---- | ---------- |
| **100%**    | 1566 | 2687   | 3576 | 101.2      |

The brief's bar is ≥ 19/20. The weakest of these 20 games still cleared 1000 by
half again.
