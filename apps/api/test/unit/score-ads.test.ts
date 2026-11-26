import type { Ad, GameState } from '@dragons-game/contracts';
import { describe, expect, it } from 'vitest';

import { buildCalibration, priorCalibration } from '../../src/engine/calibration.ts';
import type { Calibration } from '../../src/engine/calibration.ts';
import { scoreAds } from '../../src/engine/score-ads.ts';
import { STRATEGY_CONFIG } from '../../src/engine/strategy-config.ts';

const config = STRATEGY_CONFIG;
const calibration = priorCalibration({ config });

const state: GameState = { gameId: 'g1', lives: 3, gold: 0, dragonLevel: 0, turn: 0, score: 0 };

const ad = (overrides: Partial<Ad>): Ad => ({
  adId: 'a1',
  message: 'Help someone',
  reward: 20,
  expiresIn: 5,
  probability: 'Piece of cake',
  wasEncrypted: false,
  ...overrides,
});

const fixed = (probability: number): Calibration => ({ estimate: () => probability });

describe('scoreAds', () => {
  it('computes expected value as reward weighted against the cost of a life', () => {
    const [scored] = scoreAds({
      board: [ad({ probability: 'Gamble', reward: 100 })],
      state,
      calibration: fixed(0.5),
      config,
    });

    expect(scored?.estimatedProbability).toBe(0.5);
    expect(scored?.expectedValue).toBeCloseTo(
      0.5 * 100 - 0.5 * (config.lifeCostInGold + config.turnCostInGold),
    );
  });

  it('drops Impossible outright rather than scoring it', () => {
    const board = [ad({ probability: 'Impossible', reward: 9999 })];

    expect(scoreAds({ board, state, calibration: fixed(1), config })).toEqual([]);
  });

  it('drops an ad that cannot be reached before it expires', () => {
    expect(scoreAds({ board: [ad({ expiresIn: 0 })], state, calibration, config })).toEqual([]);
  });

  it('ranks a risky-but-lucrative ad above a safe-but-cheap one when the maths says so', () => {
    const board = [
      ad({ adId: 'safe', probability: 'Sure thing', reward: 10 }),
      ad({ adId: 'rich', probability: 'Gamble', reward: 400 }),
    ];

    expect(scoreAds({ board, state, calibration, config }).map(({ ad }) => ad.adId)).toEqual([
      'rich',
      'safe',
    ]);
  });

  it("prices an ad with the evidence for the dragon's level and the ad's reward", () => {
    const measured = buildCalibration({
      counts: [
        { probability: 'Piece of cake', dragonLevel: 6, reward: 20, attempts: 100, successes: 10 },
      ],
      config,
    });
    const board = [ad({})];
    const [atMeasuredLevel] = scoreAds({
      board,
      state: { ...state, dragonLevel: 6 },
      calibration: measured,
      config,
    });
    const [atFreshLevel] = scoreAds({ board, state, calibration: measured, config });

    expect(atMeasuredLevel?.estimatedProbability).toBeLessThan(0.2);
    expect(atFreshLevel?.estimatedProbability).toBeCloseTo(
      config.probabilityPrior['Piece of cake'],
    );
  });

  // A locale-aware compare would put "a" before "B"; code points put "B" (66) first everywhere.
  it('breaks an expected-value tie by adId code points, the same in every locale', () => {
    const board = [ad({ adId: 'a' }), ad({ adId: 'B' })];

    const ranked = scoreAds({ board, state, calibration, config }).map((scored) => scored.ad.adId);

    expect(ranked).toEqual(['B', 'a']);
  });
});
