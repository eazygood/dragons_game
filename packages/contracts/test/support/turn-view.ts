import { AdvisedAdSchema, TurnViewSchema } from '../../src/index.ts';
import type { AdvisedAd } from '../../src/index.ts';
import { RECORDED_SHOP_ITEMS } from './recorded-shop-items.ts';

export type Progress = { score: number; gold: number; turn: number };

export const SURE_AD_ID = 'sure1';
export const SURE_AD_MESSAGE = 'Help defend the village';
export const STARTING_PROGRESS: Progress = { score: 0, gold: 0, turn: 0 };

const DEFAULT_GAME_ID = 'g1';
const STARTING_LIVES = 3;
const STARTING_DRAGON_LEVEL = 0;

export const buildAdvisedAd = (overrides: Partial<AdvisedAd> = {}): AdvisedAd =>
  AdvisedAdSchema.parse({
    adId: SURE_AD_ID,
    message: SURE_AD_MESSAGE,
    reward: 30,
    expiresIn: 5,
    probability: 'Sure thing',
    wasEncrypted: false,
    advice: { verdict: 'recommended', estimatedProbability: 0.95, expectedValue: 25 },
    ...overrides,
  });

// Parsed rather than typed, so a fixture that drifts from the contract fails the test that
// uses it. The `game` key is dropped by the parse if the contract no longer carries one.
export const buildTurnView = ({
  gameId = DEFAULT_GAME_ID,
  progress = STARTING_PROGRESS,
}: { gameId?: string; progress?: Progress } = {}) =>
  TurnViewSchema.parse({
    game: {
      state: { gameId, lives: STARTING_LIVES, dragonLevel: STARTING_DRAGON_LEVEL, ...progress },
      status: 'active',
    },
    board: [
      buildAdvisedAd(),
      buildAdvisedAd({
        adId: 'risky1',
        message: 'Escort the merchant through the swamp',
        reward: 60,
        expiresIn: 3,
        probability: 'Risky',
        advice: { verdict: 'long_shot', estimatedProbability: 0.4, expectedValue: -18 },
      }),
    ],
    shop: RECORDED_SHOP_ITEMS,
    recommendation: {
      kind: 'solve',
      adId: SURE_AD_ID,
      reasoning: {
        rule: 'best_expected_value',
        estimatedProbability: 0.95,
        expectedValue: 25,
        consideredCount: 2,
      },
    },
  });
