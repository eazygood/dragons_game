import type { Ad, GameState, ShopItem } from '@bigbank-dragon/contracts';
import { RECORDED_SHOP_ITEMS } from '@bigbank-dragon/contracts/test-support';
import { describe, expect, it } from 'vitest';

import { priorCalibration } from '../../src/domain/engine/calibration.ts';
import type { Calibration } from '../../src/domain/engine/calibration.ts';
import { decide } from '../../src/domain/engine/decide.ts';
import { STRATEGY_CONFIG } from '../../src/domain/engine/strategy-config.ts';
import type { StrategyConfig } from '../../src/domain/engine/strategy-config.ts';

// Mechanism tests pin the values they exercise, so retuning the defaults
// cannot silently change what they prove.
const config: StrategyConfig = { ...STRATEGY_CONFIG, livesFloor: 2 };
const calibration = priorCalibration({ config });
const shop: ShopItem[] = [...RECORDED_SHOP_ITEMS];

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

describe('decide', () => {
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

  it('stops on an exhausted board with the shipped settings, however much gold is left', () => {
    // Measured: from turn ~95 every ad is Impossible, so gold spent there wins nothing.
    const exhausted = [ad({ probability: 'Impossible' }), ad({ probability: 'Impossible' })];
    const decision = decide({
      state: { ...state, lives: 4, gold: 1400 },
      board: exhausted,
      shop,
      calibration,
      config: STRATEGY_CONFIG,
    });

    expect(decision).toMatchObject({ kind: 'stop', reasoning: { rule: 'no_viable_option' } });
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
    expect(decision.reasoning.expectedValue).toBeCloseTo(
      0.9 * 20 - 0.1 * (config.lifeCostInGold + config.turnCostInGold),
    );
  });
});
