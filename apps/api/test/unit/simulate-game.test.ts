import { TARGET_SCORE } from '@dragons-game/contracts';
import { describe, expect, it } from 'vitest';

import { priorCalibration } from '../../src/engine/calibration.ts';
import { STRATEGY_CONFIG } from '../../src/engine/strategy-config.ts';
import type { StrategyConfig } from '../../src/engine/strategy-config.ts';
import { SIMULATED_TURN_CAP, simulateGame, simulateMany } from '../support/simulate-game.ts';
import type { SimulatedGame } from '../support/simulate-game.ts';

const SEEDS = Array.from({ length: 100 }, (_, index) => index + 1);
const WARMING_SEEDS = Array.from({ length: 30 }, (_, index) => index + 1000);

const mean = (values: number[]) =>
  values.reduce((total, value) => total + value, 0) / values.length;
const meanScore = (games: SimulatedGame[]) => mean(games.map(({ score }) => score));
// Per turn played, since a strategy that survives longer has more turns to lose lives in.
const lossRate = (games: SimulatedGame[]) =>
  games.reduce((total, game) => total + game.lifeLosses, 0) /
  games.reduce((total, game) => total + game.turns, 0);
const passRate = (games: SimulatedGame[]) =>
  games.filter(({ score }) => score >= TARGET_SCORE).length / games.length;

// The estimator is a fresh closure per game; the game itself is its evidence.
const outcomeOf = ({ calibration, ...game }: SimulatedGame) => ({
  ...game,
  evidence: calibration.evidence,
});

// The model keeps the baseline near its live pass rate (0.50 over 22 games); a world edit that
// lifts it past this would make every comparison below easy again.
const BASELINE_PASS_RATE_CEILING = 0.7;
const SCORE_RATIO_OVER_BASELINE = 2;
const LOSS_RATE_RATIO_TO_BASELINE = 0.75;
const PASS_RATE_MARGIN_OVER_BASELINE = 0.15;
const WARM_PASS_RATE_FLOOR = 0.95;
const NO_REWARD_BANDS = { ...STRATEGY_CONFIG, rewardBandEdges: [] };

const warmedCalibration = ({ config = STRATEGY_CONFIG }: { config?: StrategyConfig } = {}) =>
  WARMING_SEEDS.reduce(
    (calibration, seed) =>
      simulateGame({ seed, strategy: 'calibrated', config, startingCalibration: calibration })
        .calibration,
    priorCalibration({ config }),
  );

describe('simulateGame', () => {
  it('plays the same game for the same seed and a different one for another', () => {
    const first = simulateGame({ seed: 7, strategy: 'calibrated' });
    const again = simulateGame({ seed: 7, strategy: 'calibrated' });
    const other = simulateGame({ seed: 8, strategy: 'calibrated' });

    expect(outcomeOf(again)).toEqual(outcomeOf(first));
    expect(outcomeOf(other)).not.toEqual(outcomeOf(first));
  });

  it('always terminates, within the turn cap, with a coherent ending', () => {
    for (const game of simulateMany({ seeds: SEEDS, strategy: 'baseline' })) {
      expect(game.turns).toBeLessThanOrEqual(SIMULATED_TURN_CAP);
      expect(game.score).toBeGreaterThanOrEqual(0);
      expect(game.lifeLosses).toBeLessThanOrEqual(game.turns);
      if (game.endedBy === 'turn_cap') {
        expect(game.turns).toBe(SIMULATED_TURN_CAP);
      }
    }
  });

  it('lets only the calibrated strategy learn from what it attempts', () => {
    const baseline = simulateGame({ seed: 3, strategy: 'baseline' });
    const calibrated = simulateGame({ seed: 3, strategy: 'calibrated' });
    const attempts = [...calibrated.calibration.evidence.values()].reduce(
      (total, cell) => total + cell.attempts,
      0,
    );

    expect(baseline.calibration.evidence.size).toBe(0);
    expect(attempts).toBeGreaterThanOrEqual(calibrated.lifeLosses);
    expect(attempts).toBeLessThanOrEqual(calibrated.turns);
  });
});

// Cold is one game learning alone; warm starts from 30 earlier games, nearer to a live benchmark,
// where concurrent games share their evidence.
describe('strategy regression over seeded games', () => {
  const baseline = simulateMany({ seeds: SEEDS, strategy: 'baseline' });
  const calibrated = simulateMany({ seeds: SEEDS, strategy: 'calibrated' });
  const warm = simulateMany({
    seeds: SEEDS,
    strategy: 'calibrated',
    startingCalibration: warmedCalibration(),
  });

  it('keeps the baseline as hard to pass as it is live', () => {
    expect(passRate(baseline)).toBeLessThan(BASELINE_PASS_RATE_CEILING);
  });

  it('scores the calibrated strategy clearly above the baseline', () => {
    expect(meanScore(calibrated)).toBeGreaterThan(meanScore(baseline) * SCORE_RATIO_OVER_BASELINE);
  });

  it('loses lives at a markedly lower rate per turn by learning the reward traps', () => {
    expect(lossRate(calibrated)).toBeLessThan(lossRate(baseline) * LOSS_RATE_RATIO_TO_BASELINE);
  });

  it('passes clearly more often than the baseline, even cold', () => {
    expect(passRate(calibrated)).toBeGreaterThanOrEqual(
      passRate(baseline) + PASS_RATE_MARGIN_OVER_BASELINE,
    );
  });

  it('beats starting cold on score, pass rate and loss rate when it starts warm', () => {
    expect(meanScore(warm)).toBeGreaterThan(meanScore(calibrated));
    expect(passRate(warm)).toBeGreaterThan(passRate(calibrated));
    expect(lossRate(warm)).toBeLessThan(lossRate(calibrated));
  });

  it('reaches the target in nearly every game when it starts warm', () => {
    expect(passRate(warm)).toBeGreaterThanOrEqual(WARM_PASS_RATE_FLOOR);
  });

  // Cold, pooling the bands learns faster from one game's few attempts; the bands pay once
  // there is evidence for each of them.
  it('earns its reward bands once warm, against traps that do not sit on their edges', () => {
    const warmWithoutBands = simulateMany({
      seeds: SEEDS,
      strategy: 'calibrated',
      config: NO_REWARD_BANDS,
      startingCalibration: warmedCalibration({ config: NO_REWARD_BANDS }),
    });

    expect(meanScore(warm)).toBeGreaterThan(meanScore(warmWithoutBands));
    expect(lossRate(warm)).toBeLessThan(lossRate(warmWithoutBands));
  });

  it('prices a lucrative easy ad below an attemptable one once it has been learned', () => {
    const warmed = warmedCalibration();
    const estimateFor = (reward: number) =>
      warmed.estimate({ label: 'Sure thing', level: 0, reward });

    expect(estimateFor(170)).toBeLessThan(STRATEGY_CONFIG.minimumProbability);
    expect(estimateFor(50)).toBeGreaterThan(0.9);
  });
});
