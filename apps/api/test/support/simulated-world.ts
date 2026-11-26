import { PROBABILITY_LABELS } from '@bigbank-dragon/contracts';
import type { Ad, ProbabilityLabel } from '@bigbank-dragon/contracts';

// What the simulated game is, as opposed to how simulateGame plays it: the boards it deals and
// the hidden odds behind each label. Nothing here reads StrategyConfig, so the strategy is
// tested against the world rather than against its own assumptions.

const BOARD_SIZE = 10;
const MAX_EXPIRES_IN = 7;
// Skews rewards low, as the recorded boards are; tuned so the baseline passes about as often
// as it does live (0.57 here, 0.50 over 22 live games).
const REWARD_SKEW = 1.5;

// Rounded from the live attempts below level 2: a label means what it says until its reward
// reaches `trapsFrom`, then it almost always fails. The onsets are measured, not the config's
// band edges, so the bands are tested as the approximation they are.
type HiddenSuccess = { rate: number; trapsFrom: number; trappedRate: number };

const NO_TRAP = Number.POSITIVE_INFINITY;
const untrapped = (rate: number): HiddenSuccess => ({
  rate,
  trapsFrom: NO_TRAP,
  trappedRate: rate,
});

const HIDDEN_SUCCESS: Record<ProbabilityLabel, HiddenSuccess> = {
  'Sure thing': { rate: 0.99, trapsFrom: 110, trappedRate: 0.01 },
  'Piece of cake': { rate: 0.95, trapsFrom: 120, trappedRate: 0.02 },
  'Walk in the park': { rate: 0.84, trapsFrom: 145, trappedRate: 0.05 },
  'Quite likely': untrapped(0.77),
  'Hmmm....': untrapped(0.65),
  Gamble: untrapped(0.55),
  Risky: untrapped(0.45),
  'Rather detrimental': untrapped(0.36),
  'Playing with fire': untrapped(0.22),
  'Suicide mission': untrapped(0.04),
  Impossible: untrapped(0),
};

type LabelProfile = { weight: number; minReward: number; maxReward: number };

// Weights are the label counts of the recorded boards; easy labels pay little, with a thin
// tail of lucrative ones so the traps are met.
const BOARD_PROFILES: Record<ProbabilityLabel, LabelProfile> = {
  'Sure thing': { weight: 18, minReward: 1, maxReward: 180 },
  'Piece of cake': { weight: 85, minReward: 8, maxReward: 180 },
  'Walk in the park': { weight: 75, minReward: 11, maxReward: 151 },
  'Quite likely': { weight: 39, minReward: 20, maxReward: 149 },
  'Hmmm....': { weight: 36, minReward: 26, maxReward: 149 },
  Gamble: { weight: 30, minReward: 25, maxReward: 152 },
  Risky: { weight: 36, minReward: 25, maxReward: 160 },
  'Rather detrimental': { weight: 24, minReward: 38, maxReward: 154 },
  'Playing with fire': { weight: 33, minReward: 27, maxReward: 147 },
  'Suicide mission': { weight: 37, minReward: 28, maxReward: 155 },
  Impossible: { weight: 7, minReward: 101, maxReward: 154 },
};

const TOTAL_WEIGHT = PROBABILITY_LABELS.reduce(
  (total, label) => total + BOARD_PROFILES[label].weight,
  0,
);

export type Random = () => number;

// mulberry32: tiny, and identical on every platform, so a seed names one game forever.
export const randomFor = ({ seed }: { seed: number }): Random => {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);

    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

    return ((mixed ^ (mixed >>> 14)) >>> 0) / 2 ** 32;
  };
};

const drawLabel = ({ random }: { random: Random }): ProbabilityLabel => {
  let remaining = random() * TOTAL_WEIGHT;

  for (const label of PROBABILITY_LABELS) {
    remaining -= BOARD_PROFILES[label].weight;
    if (remaining < 0) {
      return label;
    }
  }

  return 'Impossible';
};

export const drawBoard = ({ random, turn }: { random: Random; turn: number }): Ad[] =>
  Array.from({ length: BOARD_SIZE }, (_, index) => {
    const probability = drawLabel({ random });
    const { minReward, maxReward } = BOARD_PROFILES[probability];
    const reward = minReward + Math.floor(random() ** REWARD_SKEW * (maxReward - minReward + 1));

    return {
      adId: `t${turn}-${index}`,
      message: 'Help someone',
      reward,
      expiresIn: 1 + Math.floor(random() * MAX_EXPIRES_IN),
      probability,
      wasEncrypted: false,
    };
  });

export const succeeds = ({ ad, random }: { ad: Ad; random: Random }) => {
  const { rate, trapsFrom, trappedRate } = HIDDEN_SUCCESS[ad.probability];

  return random() < (ad.reward >= trapsFrom ? trappedRate : rate);
};
