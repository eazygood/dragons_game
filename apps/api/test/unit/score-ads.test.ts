import type { Ad, GameState } from '@bigbank-dragon/contracts';
import { describe, expect, it, vi } from 'vitest';

import { priorCalibration } from '../../src/domain/engine/calibration.ts';
import type { Calibration } from '../../src/domain/engine/calibration.ts';
import { scoreAds } from '../../src/domain/engine/score-ads.ts';
import { STRATEGY_CONFIG } from '../../src/domain/engine/strategy-config.ts';

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
    expect(scored?.expectedValue).toBeCloseTo(0.5 * 100 - 0.5 * 70);
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

  it('estimates at the current dragon level, not at level zero', () => {
    const spy = { estimate: vi.fn().mockReturnValue(0.5) };

    scoreAds({ board: [ad({})], state: { ...state, dragonLevel: 6 }, calibration: spy, config });

    expect(spy.estimate).toHaveBeenCalledWith({ label: 'Piece of cake', level: 6 });
  });

  it('breaks expected-value ties by adId so the ranking is reproducible', () => {
    const board = [ad({ adId: 'b' }), ad({ adId: 'c' }), ad({ adId: 'a' })];

    expect(scoreAds({ board, state, calibration, config }).map(({ ad }) => ad.adId)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});
