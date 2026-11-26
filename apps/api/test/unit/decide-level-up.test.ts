import { TARGET_SCORE } from '@dragons-game/contracts';
import type { Ad, GameState, ShopItem } from '@dragons-game/contracts';
import { RECORDED_SHOP_ITEMS } from '@dragons-game/contracts/test-support';
import { describe, expect, it } from 'vitest';

import { priorCalibration } from '../../src/engine/calibration.ts';
import { decide } from '../../src/engine/decide.ts';
import { STRATEGY_CONFIG } from '../../src/engine/strategy-config.ts';
import type { StrategyConfig } from '../../src/engine/strategy-config.ts';

// Mechanism tests pin the values they exercise, so retuning the defaults
// cannot silently change what they prove.
const config: StrategyConfig = {
  ...STRATEGY_CONFIG,
  livesFloor: 2,
  levelUpFromScore: 1000,
  levelUpGoldReserve: 50,
};
const calibration = priorCalibration({ config });
const shop: ShopItem[] = [...RECORDED_SHOP_ITEMS];
const CHEAPEST_LEVEL_UP = { id: 'cs', cost: 100 };

const state: GameState = {
  gameId: 'g1',
  lives: 4,
  gold: 150,
  dragonLevel: 0,
  turn: 60,
  score: 1000,
};
const goodAd: Ad = {
  adId: 'a1',
  message: 'Help someone',
  reward: 100,
  expiresIn: 5,
  probability: 'Sure thing',
  wasEncrypted: false,
};

const decideFor = ({
  overrides = {},
  settings = config,
  board = [goodAd],
}: {
  overrides?: Partial<GameState>;
  settings?: StrategyConfig;
  board?: Ad[];
}) =>
  decide({
    state: { ...state, ...overrides },
    board,
    shop,
    calibration,
    config: settings,
  });

describe('decide, levelling up past the start score', () => {
  it('buys the cheapest level-up once the score reaches the start score', () => {
    expect(decideFor({})).toMatchObject({
      kind: 'buy',
      itemId: CHEAPEST_LEVEL_UP.id,
      reasoning: { rule: 'level_up' },
    });
  });

  it('solves instead while the score is below the start score', () => {
    expect(decideFor({ overrides: { score: 999 } })).toMatchObject({ kind: 'solve' });
  });

  it('solves instead when the level-up would eat into the potion reserve', () => {
    const gold = CHEAPEST_LEVEL_UP.cost + config.levelUpGoldReserve - 1;

    expect(decideFor({ overrides: { gold } })).toMatchObject({ kind: 'solve' });
  });

  it('buys a potion first when lives are at the floor', () => {
    expect(decideFor({ overrides: { lives: config.livesFloor } })).toMatchObject({
      kind: 'buy',
      reasoning: { rule: 'survival_floor' },
    });
  });

  it('never levels up without a start score, however much gold and score there is', () => {
    const settings = { ...config, levelUpFromScore: null };

    expect(decideFor({ overrides: { gold: 5000, score: 5000 }, settings })).toMatchObject({
      kind: 'solve',
    });
  });

  it('stops instead of levelling up when no ad on the board can be won', () => {
    const board: Ad[] = [{ ...goodAd, probability: 'Impossible' }];

    expect(decideFor({ overrides: { gold: 5000 }, board })).toMatchObject({
      kind: 'stop',
      reasoning: { rule: 'no_viable_option' },
    });
  });

  it('starts levelling up at the target score with the shipped settings', () => {
    const settings = STRATEGY_CONFIG;

    expect(decideFor({ overrides: { score: TARGET_SCORE - 1 }, settings })).toMatchObject({
      kind: 'solve',
    });
    expect(decideFor({ overrides: { score: TARGET_SCORE }, settings })).toMatchObject({
      kind: 'buy',
      reasoning: { rule: 'level_up' },
    });
  });
});
