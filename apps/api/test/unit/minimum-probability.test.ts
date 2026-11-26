import type { Ad, GameState, ProbabilityLabel } from '@dragons-game/contracts';
import { RECORDED_SHOP_ITEMS } from '@dragons-game/contracts/test-support';
import { describe, expect, it } from 'vitest';

import { adviseBoard } from '../../src/engine/advise.ts';
import type { Calibration } from '../../src/engine/calibration.ts';
import { decide } from '../../src/engine/decide.ts';
import { STRATEGY_CONFIG } from '../../src/engine/strategy-config.ts';

// The bot's choice and the advisor's verdict each compare against the threshold, so both are
// pinned exactly on it and one representable step below it.
const config = STRATEGY_CONFIG;
const shop = [...RECORDED_SHOP_ITEMS];
const REWARD = 50;
const PICK_ESTIMATE = config.probabilityPrior['Sure thing'];

const STATE: GameState = {
  gameId: 'g1',
  lives: config.livesFloor + 1,
  gold: 0,
  dragonLevel: 0,
  turn: 0,
  score: 0,
};

const adOf = ({ adId, label }: { adId: string; label: ProbabilityLabel }): Ad => ({
  adId,
  message: 'Help someone',
  reward: REWARD,
  expiresIn: 5,
  probability: label,
  wasEncrypted: false,
});

const pick = adOf({ adId: 'pick', label: 'Sure thing' });
const edge = adOf({ adId: 'edge', label: 'Gamble' });

// Prices the edge ad at exactly the estimate under test, whatever its label's prior says.
const calibrationAt = ({ probability }: { probability: number }): Calibration => ({
  estimate: ({ label }) => (label === edge.probability ? probability : PICK_ESTIMATE),
});

const cases = [
  {
    name: 'exactly at the minimum',
    probability: config.minimumProbability,
    rule: 'best_expected_value',
    verdict: 'viable',
  },
  {
    name: 'just below the minimum',
    probability: config.minimumProbability - Number.EPSILON,
    rule: 'safest_available',
    verdict: 'long_shot',
  },
] as const;

describe('the minimum probability', () => {
  it.each(cases)('$name → decide plays it by $rule', ({ probability, rule }) => {
    const decision = decide({
      state: STATE,
      board: [edge],
      shop,
      calibration: calibrationAt({ probability }),
      config,
    });

    expect(decision).toMatchObject({ kind: 'solve', adId: edge.adId, reasoning: { rule } });
  });

  it.each(cases)('$name → the advisor grades it $verdict', ({ probability, verdict }) => {
    const { ads } = adviseBoard({
      state: STATE,
      board: [pick, edge],
      shop,
      calibration: calibrationAt({ probability }),
      config,
    });

    expect(ads.find(({ adId }) => adId === edge.adId)?.advice.verdict).toBe(verdict);
  });
});
