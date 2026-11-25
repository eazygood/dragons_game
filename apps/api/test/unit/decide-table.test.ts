import { IMPOSSIBLE_LABEL, PROBABILITY_LABELS } from '@bigbank-dragon/contracts';
import type { Ad, GameState, ProbabilityLabel } from '@bigbank-dragon/contracts';
import { RECORDED_SHOP_ITEMS } from '@bigbank-dragon/contracts/test-support';
import { describe, expect, it } from 'vitest';

import { buildCalibration } from '../../src/domain/engine/calibration.ts';
import { decide } from '../../src/domain/engine/decide.ts';
import { STRATEGY_CONFIG } from '../../src/domain/engine/strategy-config.ts';

// The regression table for the shipped strategy: every label, a level in every calibration
// bucket, plaintext and encrypted boards. Expectations come from the config, not literals.
const config = STRATEGY_CONFIG;
const shop = [...RECORDED_SHOP_ITEMS];
const REWARD = 50;
const LEVELS = [0, ...config.levelBucketEdges];
const MEASURED_LEVEL = config.levelBucketEdges.at(-1) ?? 0;
const FAILED_ATTEMPTS = 40;

// Every label measured as a failure in the top level bucket only, so a dragon's level
// decides whether the label's prior or the measurement prices the ad.
const calibration = buildCalibration({
  counts: PROBABILITY_LABELS.map((probability) => ({
    probability,
    dragonLevel: MEASURED_LEVEL,
    reward: REWARD,
    attempts: FAILED_ATTEMPTS,
    successes: 0,
  })),
  config,
});

const stateAt = ({ dragonLevel }: { dragonLevel: number }): GameState => ({
  gameId: 'g1',
  lives: config.livesFloor + 1,
  gold: 0,
  dragonLevel,
  turn: 0,
  score: 0,
});

const adOf = ({ label, wasEncrypted }: { label: ProbabilityLabel; wasEncrypted: boolean }): Ad => ({
  adId: 'only',
  message: 'Help someone',
  reward: REWARD,
  expiresIn: 5,
  probability: label,
  wasEncrypted,
});

const expectedRuleFor = ({ label, level }: { label: ProbabilityLabel; level: number }) => {
  if (label === IMPOSSIBLE_LABEL) {
    return 'no_viable_option';
  }

  const estimate = calibration.estimate({ label, level, reward: REWARD });

  return estimate >= config.minimumProbability ? 'best_expected_value' : 'safest_available';
};

const cases = PROBABILITY_LABELS.flatMap((label) =>
  LEVELS.flatMap((level) =>
    [false, true].map((wasEncrypted) => ({
      label,
      level,
      board: wasEncrypted ? 'encrypted' : 'plaintext',
      wasEncrypted,
      rule: expectedRuleFor({ label, level }),
    })),
  ),
);

describe('decide, across labels, levels and boards', () => {
  it('covers both sides of the probability floor and of the measured level', () => {
    const rules = new Set(cases.map(({ rule }) => rule));

    expect(rules).toEqual(new Set(['best_expected_value', 'safest_available', 'no_viable_option']));
  });

  it.each(cases)(
    '$label at level $level on a $board board → $rule',
    ({ label, level, wasEncrypted, rule }) => {
      const decision = decide({
        state: stateAt({ dragonLevel: level }),
        board: [adOf({ label, wasEncrypted })],
        shop,
        calibration,
        config,
      });

      if (rule === 'no_viable_option') {
        expect(decision).toMatchObject({ kind: 'stop', reasoning: { rule } });
        return;
      }

      expect(decision).toMatchObject({ kind: 'solve', adId: 'only', reasoning: { rule } });
    },
  );
});
