# Phase 1 benchmark — raw numbers

Every number here came from `pnpm bench` against the live API, on 2026-11-23
(§1–§7) and in later runs through 2026-11-26 (§8–§11); §12 reads the attempts
those runs stored. **Cold** means calibration reads only the
current benchmark's own games: `calibrated` starts from the priors alone and
learns within the invocation, 3 games in parallel sharing the evidence. It is
what a first-time reviewer with an empty database gets. `--warm` reads all
stored history instead.

How "cold" was achieved changed during the day. §1–§6 ran with an earlier
benchmark that truncated `ad_attempts` before a cold run. A later change made a
cold run scope calibration to its own games (`calibrationBenchmarkId`) instead,
deleting nothing; §7 and §8 were measured that way. Both start the engine
from the same priors.

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
reloaded every turn. (The bot now folds its own attempts in memory, which counts
them exactly as a re-read would, and re-reads every 10 turns to pick up the other
games'; see [`architecture.md`](../architecture.md) §Calibration.)

## 3. Must-verify list

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
longer and none fell short. Pass rate is the measure we optimise for, so
**level-ups are off** below the target. A plausible cause, not measured then:
every level-up moves the dragon into a fresh level bucket, where the engine must
relearn the traps. §11 brings level-ups back only past 1000, and shows that
cause in one game.

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

Our acceptance bar, chosen by us rather than set by the brief, is ≥ 19/20. The
weakest of these 20 games still cleared 1000 by half again.

## 7. Games that stop with gold unspent

The acceptance database shows 16 of 20 runs ended `abandoned`. They were at
4 lives with 858–2234 gold left (about 1400 on average) around turn 99, and all
at dragon level 0. The 4 runs that ended `game_over` were the low scorers (min
1566). None of the three level-up-on benchmarks ever stopped (levels 18–28).

A live probe confirmed the cause. By turn ~94 all 10 ads on the board are
`Impossible`, and spending turns on potions surfaces at most one `Suicide
mission`. So the engine had no attemptable ad and stopped.

**Tried and reverted:** an exhausted-board level-up. When no ad was
attemptable, the engine bought the cheapest affordable level-up even with
proactive level-ups off, and stopped only when it could not afford one.

Re-benchmark (cold, 20 runs, same config otherwise):

| Metric            | Acceptance (§6) | With the level-up rule |
| ----------------- | --------------- | ---------------------- |
| Pass ≥ 1000       | 20/20           | 19/20                  |
| Min / median      | 1566 / 2687     | 21 / 2428              |
| Mean turns        | 101.2           | 116.1                  |
| Ended `abandoned` | 16              | 8                      |

- 7 games reached an exhausted board between turns 96 and 106 and bought 8–22
  level-ups there. **None of them won any reward after the first level-up.**
  Levelling up does not bring attemptable ads back, so the rule was removed.
- The other 12 games ran out of lives before their board ran dry, so the rule
  never acted in them. The lower median is game-to-game variance, not the rule.
- The one failure (`uhVgOkuh`, score 21) lost its 3 lives in 5 turns on ads
  estimated at 0.76, 0.73 and 0.88, with under 50 gold, so no potion was
  affordable. The rule never acted. Nothing in the engine guards the opening
  turns, which makes this the only measured way to miss 1000.

Stopping on an exhausted board is therefore correct: by then the game is over
in all but name. Gold left at that point is not lost score.

Open question: the three proactive level-up benchmarks never stopped. It is not
known whether levelling up _early_ keeps the board from running dry, or whether
those games simply died first. §11 does not settle it: its 20 level-up games all
died, the longest at turn 103, about when the boards here ran dry.

The proactive level-up verdict (§4) rests on 95% vs 100%, which is one run in
twenty. Treat it as weak evidence.

## 8. Re-measures

The shipped `STRATEGY_CONFIG`, unchanged since §6, cold, 20 runs each. The
2026-11-23 acceptance run is in §6.

| Run                              | Pass ≥ 1000      | Min  | Median | Max  | Mean turns |
| -------------------------------- | ---------------- | ---- | ------ | ---- | ---------- |
| 11-24                            | **95%** (19/20)  | 955  | 2723.5 | 3993 | 107.6      |
| 11-25, after bot-resilience work | **100%** (20/20) | 1794 | 2503.5 | 3361 | 108.5      |
| 11-25, after review fixes, A     | **95%** (19/20)  | 41   | 2611   | 3739 | 103.2      |
| 11-25, after review fixes, B     | **95%** (19/20)  | 938  | 2782.5 | 3678 | 107.1      |

On 11-24 one game finished at 955, 45 short of the target. That still meets our
bar of ≥ 19/20, but with no margin. Twenty runs cannot tell 95% from 100% apart,
so read the runs as samples of the same strategy, not as a regression. On 11-25
no run failed, so the consecutive-failure cap never fired. With §6, the strategy
has passed 59 of 60 games.

Runs A and B measure the same `STRATEGY_CONFIG` after the review fixes, which
re-read calibration every 10 turns so concurrent games share evidence. Each
missed once:

- **A** (`d92d65af`): one game scored 41. It lost 3 lives by turn 8, before it
  had gold for a potion. This is the same unguarded opening as `uhVgOkuh` in §7.
- **B** (`b133097c`): one game finished at 938 after 57 turns. Three upstream
  solves timed out during B. Each was logged as `turn failed; playing on` and
  absorbed without failing a run.

Run A predates the calibration-read fallback fix, which changes only the
database-failure path. In all, the strategy has passed 97 of 100 games.

## 9. The late-game plateau, and why there is no stop rule

Late in a game the board can run down to ads the calibration prices near zero.
The engine then plays `safest_available`, usually fails, buys a potion and
tries again. A live QA game (`n6yv9FV3`) sat at 2292 from turn ~65 to 128 this
way. The re-evaluation proposed a late-game stop rule.

Measured over every benchmarked `calibrated` game in the local database (310
games, all configs since §4), the `safest_available` attempts by estimate:

| Estimate    | Attempts | Won   | Score per attempt | Games |
| ----------- | -------- | ----- | ----------------- | ----- |
| < 0.10      | 1857     | 2.6%  | 1.7               | 110   |
| 0.10 – 0.20 | 500      | 4.4%  | 3.1               | 71    |
| 0.20 – 0.30 | 390      | 13.1% | 9.6               | 85    |
| ≥ 0.30      | 655      | 30.2% | 22.6              | 122   |

A rule that stopped below 0.10 would have acted in 110 games, ending each about
17 attempts early. With a potion after most failures, that is roughly 30 turns
of a ~100-turn game. It would have cost those games about 29 points each (10
per game across all 310) out of a 2548 average. **In none of the 310 games did
those attempts carry the score across 1000.**

A stop rule can only end a game earlier, and the score never falls within a
game, so it cannot raise the pass rate. It saves turns, which the brief does
not score, and costs a few points. So it is not shipped. If turns ever cost
something (wall-clock time on the shared upstream, say), this table is the
case for it.

## 10. The leaderboard, and why it is not a target

On 2026-11-26 the public leaderboard's top five read 1,019,978,705,
31,627,908, 26,869,060, 21,785,750 and 8,277,173. The question was whether the
engine should chase them.

What the local database holds (532 games, 19,932 ad attempts, every config):

| Measure                | Value                                       |
| ---------------------- | ------------------------------------------- |
| Best game              | 5169 (level 50, 96 turns, level-ups on, §1) |
| Longest game           | 172 turns                                   |
| Highest dragon level   | 51                                          |
| Largest reward offered | 811                                         |
| Largest reward won     | 317                                         |

Rewards do grow with dragon level. The attempts of the §11 run (`44f556c5`),
by the level at the time of the attempt (the high-level attempts of §1–§6 were
truncated, so this is the only clean sample):

| Level | Attempts | Mean reward | Max reward | Won   | Score per attempt |
| ----- | -------- | ----------- | ---------- | ----- | ----------------- |
| 0     | 440      | 62          | 193        | 84.8% | 48.0              |
| 1–9   | 53       | 167         | 340        | 75.5% | 112.6             |
| 10–19 | 193      | 205         | 505        | 56.5% | 96.3              |
| 20–29 | 125      | 214         | 541        | 56.8% | 118.8             |
| 30–39 | 94       | 291         | 811        | 19.1% | 46.2              |
| 40+   | 6        | 344         | 407        | 0%    | 0                 |

They stay in the hundreds, and the win rate falls as they rise. The 42 recorded
level-0 boards in `test/fixtures` (420 ads) top out at 160, `Impossible` ads
included (154), so no outsized reward hides behind a label either.

A bound that is generous on every axis: the longest game ever seen, winning the
largest reward ever offered on every turn, scores 172 × 811 = 139,492. First
place is about 7,300 times that and fifth place about 59 times. At 811 a win,
fifth place needs some 10,200 wins and first place some 1.26 million. Our games
end when lives run out or, at level 0, when the board turns all `Impossible`
(§7), by turn 172 at the latest.

So those scores come from something other than playing the game as measured
here: an upstream bug, an exploit, or a mechanic that appears only far beyond
anything we reached. We did not look for which. The brief asks for a program
that plays to 1000, and an exploit is not a strategy. **Not a target.**

## 11. Level-ups past the target

§4 turned level-ups off because they cost pass rate, and below 1000 that still
holds. Past 1000 the score cannot fall back below the target, so a rule that
acts only from there cannot change the pass rate. It only changes what a game
does with gold it would otherwise end with: about 1400 per stopped game in §7.

The rule, `level_up`, runs right after `survival_floor`. Once the score reaches
`levelUpFromScore` (1000), it buys the cheapest level-up, provided that leaves
`levelUpGoldReserve` (50, one potion) and at least one ad on the board is
attemptable.

Cold, 20 runs each, back to back on 2026-11-26:

| Run                              | Pass ≥ 1000 | Min  | Median     | Max      | Mean turns | Ended                     | Final level   |
| -------------------------------- | ----------- | ---- | ---------- | -------- | ---------- | ------------------------- | ------------- |
| no level-ups (`05a010b6`)        | 100%        | 1257 | 2620.5     | 3602     | 102.4      | 13 abandoned, 7 game over | 0             |
| level-ups past 1000 (`44f556c5`) | 100%        | 1101 | **3579.5** | **4543** | 83.7       | 20 game over              | 8–40, mean 26 |

- Both runs crossed 1000 between turns 22 and 47, and until then they play the
  same engine.
- Each level-up game bought its first level-up the turn after crossing, then
  8–40 in all. None was refused.
- 19 of the 20 scored 883–3472 more after their first level-up. The median rose
  by 959, past every earlier median (2503.5–2782.5, §8), to about the maximum of
  the run without level-ups. Games are shorter because they die instead of
  stopping on an empty board.
- The weakest game (1101) is the cost. It crossed at turn 30 and spent turns
  31–38 on eight level-ups in a row. At level 8 it then lost five ads in a row,
  `Sure thing` and `Piece of cake` ads paying 229–340 that it estimated at
  0.95–0.48, and died at turn 44 with nothing added. It was a first-wave game:
  the whole run held 4 attempts at level 6 or above by then, so its estimates
  were the priors. That is §4's suspected cause, now seen directly.
- No game reached an exhausted board. If one did, levels would bring nothing
  back (§7), so the rule waits for an attemptable ad and the engine stops
  instead.

**Shipped:** `levelUpFromScore` = `TARGET_SCORE`.
`pnpm bench --override '{"levelUpFromScore":null}'` reproduces the run without
level-ups. Below 1000 the two are the same engine, so §6, §8 and both runs here
add up to **137 of 140** games past 1000.

Open, not measured:

- **Over-levelling.** Score per attempt holds from level 1 to 29 and collapses
  from 30 (19% won, §10). A level cap, or spacing the level-ups out, might keep
  games in the range that pays.
- **Calibration above level 6.** The level buckets end at 6, so levels 6–51
  share one. Finer buckets might fix estimates like the level-8 ones above, or
  just spread the evidence thinner.
- **The gold reserve.** 50 is one potion, not a swept value.
- **Level-ups before 1000** stay off. §4 is the only evidence, and it is weak.

## 12. The priors against what was measured

`probabilityPrior` was written before the first game was played and has never
been tuned. The eleven labels read as an ordered ladder, so the values step from
0.95 down to 0, and `Impossible` is 0 by definition. No failure pointed at it:
the reward trap was fixed by the reward band (§4) and α = 2 (§5), which unlearn
a wrong prior faster rather than correct it, and §5 swept the knobs the
failures did point at.

Measured on 2026-11-27 over every attempt stored by then: 20,061 attempts in 358
games, 2026-11-23 to 2026-11-26. 14,548 of them paid under 100 gold, the band
where the label holds (§2), so that column is the fair test of a prior that
ignores reward:

| Label              | Prior | Won, reward < 100 | Attempts < 100 | Won, all rewards |
| ------------------ | ----- | ----------------- | -------------- | ---------------- |
| Sure thing         | 0.95  | 1.00              | 1005           | 0.43             |
| Piece of cake      | 0.90  | 0.96              | 3338           | 0.67             |
| Walk in the park   | 0.85  | 0.85              | 2048           | 0.80             |
| Quite likely       | 0.75  | 0.78              | 1544           | 0.77             |
| Hmmm....           | 0.60  | 0.65              | 1052           | 0.64             |
| Gamble             | 0.50  | 0.56              | 795            | 0.55             |
| Risky              | 0.40  | 0.44              | 786            | 0.45             |
| Rather detrimental | 0.30  | 0.35              | 660            | 0.36             |
| Playing with fire  | 0.20  | 0.22              | 634            | 0.23             |
| Suicide mission    | 0.10  | 0.04              | 2686           | 0.04             |

- Every label lands within 0.06 of its prior. All but `Suicide mission` measure
  at or above it, so the guess errs on the safe side, and `Suicide mission` is
  under the probability floor either way.
- `Risky` measures 0.44, still under `minimumProbability` (0.45), so a truer
  prior there would not have changed a choice.
- The prior misses where reward matters, and badly. At 100–159 gold and at 160+,
  `Sure thing` wins 0.01 and 0.00, `Piece of cake` 0.12 and 0.00 (§2). One
  number per label cannot fit both sides, so the reward band learns those cells
  instead. In the two runs of §11 (`05a010b6`, `44f556c5`), such ads chosen on
  the prior (`best_expected_value`, estimated about 0.7) lost 15 and 27 times in
  20 games: about one life a game, at 100% pass. A prior per reward band would
  save those; it is not built and not measured.
- Another 151 and 29 such losses were `safest_available`, on boards with
  nothing above the floor, estimated 0.11–0.23. A truer prior would change which
  bad ad the engine took there, not whether it took one.
- The sample is the engine's own choices, so labels under the floor were mostly
  played as the fallback. `Impossible` has no attempts: the engine filters it
  out.
