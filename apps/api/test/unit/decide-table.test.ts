import { PROBABILITY_LABELS } from '@bigbank-dragon/contracts';
import type { Ad, DecisionRule, GameState, ProbabilityLabel } from '@bigbank-dragon/contracts';
import { RECORDED_SHOP_ITEMS } from '@bigbank-dragon/contracts/test-support';
import { describe, expect, it } from 'vitest';

import { buildCalibration } from '../../src/domain/engine/calibration.ts';
import { decide } from '../../src/domain/engine/decide.ts';
import { STRATEGY_CONFIG } from '../../src/domain/engine/strategy-config.ts';

// The regression table for the shipped strategy. The expected rules are written out, not
// computed, so a retuned prior or floor has to be acknowledged here.
const config = STRATEGY_CONFIG;
const shop = [...RECORDED_SHOP_ITEMS];
const REWARD = 50;
const UNMEASURED_LEVEL = 0;
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

const adOf = ({ label }: { label: ProbabilityLabel }): Ad => ({
  adId: 'only',
  message: 'Help someone',
  reward: REWARD,
  expiresIn: 5,
  probability: label,
  wasEncrypted: false,
});

const rows: { label: ProbabilityLabel; level: number; rule: DecisionRule }[] = [
  { label: 'Sure thing', level: UNMEASURED_LEVEL, rule: 'best_expected_value' },
  { label: 'Sure thing', level: MEASURED_LEVEL, rule: 'safest_available' },
  { label: 'Gamble', level: UNMEASURED_LEVEL, rule: 'best_expected_value' },
  { label: 'Gamble', level: MEASURED_LEVEL, rule: 'safest_available' },
  { label: 'Risky', level: UNMEASURED_LEVEL, rule: 'safest_available' },
  { label: 'Suicide mission', level: UNMEASURED_LEVEL, rule: 'safest_available' },
  { label: 'Impossible', level: UNMEASURED_LEVEL, rule: 'no_viable_option' },
  { label: 'Impossible', level: MEASURED_LEVEL, rule: 'no_viable_option' },
];

describe('decide, across labels and levels', () => {
  it.each(rows)('$label at level $level → $rule', ({ label, level, rule }) => {
    const decision = decide({
      state: stateAt({ dragonLevel: level }),
      board: [adOf({ label })],
      shop,
      calibration,
      config,
    });

    if (rule === 'no_viable_option') {
      expect(decision).toMatchObject({ kind: 'stop', reasoning: { rule } });
      return;
    }

    expect(decision).toMatchObject({ kind: 'solve', adId: 'only', reasoning: { rule } });
  });
});
