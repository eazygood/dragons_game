import { SHOP_ITEM_PRIOR } from '@bigbank-dragon/contracts';
import type { Ad, GameState, ShopItem } from '@bigbank-dragon/contracts';
import { describe, expect, it } from 'vitest';

import { priorCalibration } from '../../src/domain/engine/calibration.ts';
import type { Calibration } from '../../src/domain/engine/calibration.ts';
import { decide } from '../../src/domain/engine/decide.ts';
import { STRATEGY_CONFIG } from '../../src/domain/engine/strategy-config.ts';

const config = STRATEGY_CONFIG;
const calibration = priorCalibration({ config });
const shop: ShopItem[] = [...SHOP_ITEM_PRIOR];

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

const board = [
  ad({ adId: 'cake', probability: 'Piece of cake', reward: 20 }),
  ad({ adId: 'gamble', probability: 'Gamble', reward: 100 }),
];

describe('decide', () => {
  it('buys a healing potion instead of playing when lives are at the floor', () => {
    const decision = decide({
      state: { ...state, lives: 1, gold: 60 },
      board: [ad({ probability: 'Sure thing' })],
      shop,
      calibration,
      config,
    });

    expect(decision).toMatchObject({
      kind: 'buy',
      itemId: 'hpot',
      reasoning: { rule: 'survival_floor' },
    });
  });

  it('plays on at the lives floor when it cannot afford a potion', () => {
    const decision = decide({
      state: { ...state, lives: 1, gold: 10 },
      board: [ad({ probability: 'Sure thing' })],
      shop,
      calibration,
      config,
    });

    expect(decision.kind).toBe('solve');
  });

  it('picks the highest expected value above the probability floor', () => {
    const candidates = [
      ad({ adId: 'a', probability: 'Sure thing', reward: 10 }),
      ad({ adId: 'b', probability: 'Quite likely', reward: 300 }),
    ];

    expect(decide({ state, board: candidates, shop, calibration, config })).toMatchObject({
      kind: 'solve',
      adId: 'b',
      reasoning: { rule: 'best_expected_value' },
    });
  });

  it('falls back to the safest ad when nothing clears the probability floor', () => {
    const candidates = [
      ad({ adId: 'risky', probability: 'Suicide mission', reward: 900 }),
      ad({ adId: 'less', probability: 'Risky', reward: 5 }),
    ];

    expect(decide({ state, board: candidates, shop, calibration, config })).toMatchObject({
      kind: 'solve',
      adId: 'less',
      reasoning: { rule: 'safest_available' },
    });
  });

  // Review Focus #1
  it('stops rather than solving nothing when every ad is filtered out', () => {
    const unusable = [ad({ probability: 'Impossible' }), ad({ expiresIn: 0 })];
    const decision = decide({
      state: { ...state, gold: 0 },
      board: unusable,
      shop,
      calibration,
      config,
    });

    expect(decision).toMatchObject({ kind: 'stop', reasoning: { rule: 'no_viable_option' } });
  });

  it('buys rather than stopping when the board is unusable but gold allows', () => {
    const unusable = [ad({ probability: 'Impossible' })];

    expect(
      decide({ state: { ...state, gold: 400 }, board: unusable, shop, calibration, config }).kind,
    ).toBe('buy');
  });

  it('levels up only with gold to spare above the potion reserve', () => {
    const rich = decide({
      state: { ...state, gold: 500, lives: 3 },
      board: [ad({ probability: 'Risky', reward: 1 })],
      shop,
      calibration,
      config,
    });

    expect(rich).toMatchObject({ kind: 'buy', itemId: 'cs', reasoning: { rule: 'level_up' } });
  });

  it('keeps playing a good board when levelling up would dip into the reserve', () => {
    const decision = decide({ state: { ...state, gold: 400 }, board, shop, calibration, config });

    expect(decision.reasoning.rule).toBe('best_expected_value');
  });

  it('never levels up when the policy is disabled', () => {
    const decision = decide({
      state: { ...state, gold: 500 },
      board,
      shop,
      calibration,
      config: { ...config, levelUpEnabled: false },
    });

    expect(decision.reasoning.rule).not.toBe('level_up');
  });

  it('reports the estimate and expected value it acted on', () => {
    const decision = decide({
      state,
      board: [ad({ probability: 'Sure thing', reward: 20 })],
      shop,
      calibration: fixed(0.9),
      config,
    });

    expect(decision.reasoning).toMatchObject({ estimatedProbability: 0.9, consideredCount: 1 });
    expect(decision.reasoning.expectedValue).toBeCloseTo(0.9 * 20 - 0.1 * 70);
  });

  it('is pure — the same inputs give the same decision', () => {
    expect(decide({ state, board, shop, calibration, config })).toEqual(
      decide({ state, board, shop, calibration, config }),
    );
  });
});
