import type { Ad, GameState } from '@dragons-game/contracts';
import { RECORDED_SHOP_ITEMS } from '@dragons-game/contracts/test-support';
import { describe, expect, it } from 'vitest';

import { adviseBoard, playerChoiceReasoning } from '../../src/domain/engine/advise.ts';
import { priorCalibration } from '../../src/domain/engine/calibration.ts';
import { decide } from '../../src/domain/engine/decide.ts';
import { STRATEGY_CONFIG } from '../../src/domain/engine/strategy-config.ts';

const state: GameState = { gameId: 'g', lives: 3, gold: 0, dragonLevel: 0, turn: 0, score: 0 };
const calibration = priorCalibration({ config: STRATEGY_CONFIG });

const ad = (overrides: Partial<Ad>): Ad => ({
  adId: 'a1',
  message: 'Help someone',
  reward: 20,
  expiresIn: 5,
  probability: 'Piece of cake',
  wasEncrypted: false,
  ...overrides,
});

const sure = ad({ adId: 'sure', probability: 'Sure thing', reward: 30 });
const risky = ad({ adId: 'risky', probability: 'Risky', reward: 40 });
const impossible = ad({ adId: 'imp', probability: 'Impossible', reward: 200 });
const expired = ad({ adId: 'gone', probability: 'Piece of cake', reward: 50, expiresIn: 0 });
const board = [sure, risky, impossible, expired];
const input = {
  state,
  board,
  shop: [...RECORDED_SHOP_ITEMS],
  calibration,
  config: STRATEGY_CONFIG,
};

describe('adviseBoard', () => {
  it('grades every ad on the board', () => {
    const { ads } = adviseBoard(input);

    expect(ads.map(({ adId, advice }) => [adId, advice.verdict])).toEqual([
      ['sure', 'recommended'],
      ['risky', 'long_shot'],
      ['imp', 'unattemptable'],
      ['gone', 'unattemptable'],
    ]);
    expect(ads.find(({ adId }) => adId === 'imp')?.advice.estimatedProbability).toBe(0);
  });

  it('marks an attemptable ad above the threshold as viable when it is not the pick', () => {
    const second = ad({ adId: 'cake', probability: 'Piece of cake', reward: 20 });
    const { ads } = adviseBoard({ ...input, board: [sure, second] });

    expect(ads.find(({ adId }) => adId === 'cake')?.advice.verdict).toBe('viable');
  });

  it.each([
    ['a normal board', input],
    ['an exhausted board', { ...input, board: [impossible, expired] }],
    ['the survival floor', { ...input, state: { ...state, lives: 1, gold: 60 } }],
  ])('never disagrees with decide() on %s', (_name, scenario) => {
    expect(adviseBoard(scenario).recommendation).toEqual(decide(scenario));
  });

  it('recommends no ad when the engine buys', () => {
    const { ads } = adviseBoard({ ...input, state: { ...state, lives: 1, gold: 60 } });

    expect(ads.some(({ advice }) => advice.verdict === 'recommended')).toBe(false);
  });
});

describe('playerChoiceReasoning', () => {
  it('prices a player choice of an Impossible ad as a certain loss', () => {
    expect(playerChoiceReasoning({ ...input, ad: impossible })).toEqual({
      rule: 'player_choice',
      estimatedProbability: 0,
      expectedValue: -70,
      consideredCount: 2,
    });
  });
});
