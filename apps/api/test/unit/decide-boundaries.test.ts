import { HEALING_POTION_ID, IMPOSSIBLE_LABEL, PROBABILITY_LABELS } from '@bigbank-dragon/contracts';
import type { Ad, DecisionRule, GameState, ProbabilityLabel } from '@bigbank-dragon/contracts';
import { RECORDED_SHOP_ITEMS } from '@bigbank-dragon/contracts/test-support';
import { describe, expect, it } from 'vitest';

import { priorCalibration } from '../../src/domain/engine/calibration.ts';
import { decide } from '../../src/domain/engine/decide.ts';
import { STRATEGY_CONFIG } from '../../src/domain/engine/strategy-config.ts';

// The shipped strategy at its boundaries; expectations come from the config, not literals.
const config = STRATEGY_CONFIG;
const calibration = priorCalibration({ config });
const shop = [...RECORDED_SHOP_ITEMS];
const REWARD = 50;

const STATE: GameState = {
  gameId: 'g1',
  lives: config.livesFloor + 1,
  gold: 0,
  dragonLevel: 0,
  turn: 0,
  score: 0,
};

const adOf = ({ label }: { label: ProbabilityLabel }): Ad => ({
  adId: 'only',
  message: 'Help someone',
  reward: REWARD,
  expiresIn: 5,
  probability: label,
  wasEncrypted: false,
});

const potion = shop.find((item) => item.id === HEALING_POTION_ID);
const potionCost = potion?.cost ?? 0;
const sureThing = adOf({ label: 'Sure thing' });

type FloorCase = {
  name: string;
  lives: number;
  gold: number;
  shopListsPotion: boolean;
  kind: 'buy' | 'solve';
  rule: DecisionRule;
};

const floorCases: FloorCase[] = [
  {
    name: 'lives exactly at the floor, potion affordable',
    lives: config.livesFloor,
    gold: potionCost,
    shopListsPotion: true,
    kind: 'buy',
    rule: 'survival_floor',
  },
  {
    name: 'lives below the floor, potion affordable',
    lives: config.livesFloor - 1,
    gold: potionCost,
    shopListsPotion: true,
    kind: 'buy',
    rule: 'survival_floor',
  },
  {
    name: 'lives below the floor, one gold short of the potion',
    lives: config.livesFloor - 1,
    gold: potionCost - 1,
    shopListsPotion: true,
    kind: 'solve',
    rule: 'best_expected_value',
  },
  {
    name: 'lives one above the floor',
    lives: config.livesFloor + 1,
    gold: potionCost,
    shopListsPotion: true,
    kind: 'solve',
    rule: 'best_expected_value',
  },
  {
    name: 'lives at the floor, one gold short of the potion',
    lives: config.livesFloor,
    gold: potionCost - 1,
    shopListsPotion: true,
    kind: 'solve',
    rule: 'best_expected_value',
  },
  {
    name: 'lives at the floor, no potion in the shop',
    lives: config.livesFloor,
    gold: potionCost * 10,
    shopListsPotion: false,
    kind: 'solve',
    rule: 'best_expected_value',
  },
];

describe('decide at the survival floor', () => {
  it.each(floorCases)('$name → $kind ($rule)', ({ lives, gold, shopListsPotion, kind, rule }) => {
    const decision = decide({
      state: { ...STATE, lives, gold },
      board: [sureThing],
      shop: shopListsPotion ? shop : shop.filter((item) => item.id !== HEALING_POTION_ID),
      calibration,
      config,
    });
    const target = kind === 'buy' ? { itemId: HEALING_POTION_ID } : { adId: sureThing.adId };

    expect(decision).toMatchObject({ kind, ...target, reasoning: { rule } });
  });
});

const LONG_SHOT =
  PROBABILITY_LABELS.find(
    (label) =>
      label !== IMPOSSIBLE_LABEL && config.probabilityPrior[label] < config.minimumProbability,
  ) ?? IMPOSSIBLE_LABEL;

const twin = ({
  adId,
  label,
  reward = REWARD,
}: {
  adId: string;
  label: ProbabilityLabel;
  reward?: number;
}): Ad => ({
  ...adOf({ label }),
  adId,
  reward,
});

describe('decide between equally safe ads', () => {
  it.each([
    {
      name: 'identical viable ads → the lowest id, whatever the board order',
      board: [twin({ adId: 'b', label: 'Sure thing' }), twin({ adId: 'a', label: 'Sure thing' })],
      adId: 'a',
      rule: 'best_expected_value',
    },
    {
      name: 'equally safe viable ads → the larger reward',
      board: [
        twin({ adId: 'a', label: 'Sure thing' }),
        twin({ adId: 'b', label: 'Sure thing', reward: REWARD * 2 }),
      ],
      adId: 'b',
      rule: 'best_expected_value',
    },
    {
      name: 'identical long shots → the lowest id',
      board: [twin({ adId: 'b', label: LONG_SHOT }), twin({ adId: 'a', label: LONG_SHOT })],
      adId: 'a',
      rule: 'safest_available',
    },
    {
      name: 'equally safe long shots → the larger reward',
      board: [
        twin({ adId: 'a', label: LONG_SHOT }),
        twin({ adId: 'b', label: LONG_SHOT, reward: REWARD * 2 }),
      ],
      adId: 'b',
      rule: 'safest_available',
    },
  ])('$name', ({ board, adId, rule }) => {
    const decision = decide({
      state: STATE,
      board,
      shop,
      calibration,
      config,
    });

    expect(decision).toMatchObject({ kind: 'solve', adId, reasoning: { rule } });
  });
});
