import { HEALING_POTION_ID } from '@bigbank-dragon/contracts';
import type {
  Ad,
  Decision,
  DecisionRule,
  GameState,
  Reasoning,
  ShopItem,
} from '@bigbank-dragon/contracts';

import type { Calibration } from './calibration.ts';
import { scoreAds } from './score-ads.ts';
import type { ScoredAd } from './score-ads.ts';
import type { StrategyConfig } from './strategy-config.ts';

type DecideInput = {
  state: GameState;
  board: Ad[];
  shop: ShopItem[];
  calibration: Calibration;
  config: StrategyConfig;
};

// A buy or a stop acts on no single ad, so it carries no estimate.
const unscoredReasoning = ({
  rule,
  scored,
}: {
  rule: DecisionRule;
  scored: ScoredAd[];
}): Reasoning => ({
  rule,
  estimatedProbability: null,
  expectedValue: null,
  consideredCount: scored.length,
});

const solve = ({
  rule,
  scored,
  pick,
}: {
  rule: DecisionRule;
  scored: ScoredAd[];
  pick: ScoredAd;
}): Decision => ({
  kind: 'solve',
  adId: pick.ad.adId,
  reasoning: {
    rule,
    estimatedProbability: pick.estimatedProbability,
    expectedValue: pick.expectedValue,
    consideredCount: scored.length,
  },
});

const buy = ({
  rule,
  scored,
  item,
}: {
  rule: DecisionRule;
  scored: ScoredAd[];
  item: ShopItem;
}): Decision => ({
  kind: 'buy',
  itemId: item.id,
  reasoning: unscoredReasoning({ rule, scored }),
});

const safest = ({ scored }: { scored: ScoredAd[] }) =>
  scored.toSorted((left, right) => right.estimatedProbability - left.estimatedProbability)[0];

export const decide = ({ state, board, shop, calibration, config }: DecideInput): Decision => {
  const scored = scoreAds({ board, state, calibration, config });
  const potion = shop.find((item) => item.id === HEALING_POTION_ID);

  // Lives, not gold, end the game, so gold goes to a potion once lives reach the floor.
  if (state.lives <= config.livesFloor && potion && state.gold >= potion.cost) {
    return buy({ rule: 'survival_floor', scored, item: potion });
  }

  const viableAds = scored.filter(
    (entry) => entry.estimatedProbability >= config.minimumProbability,
  );
  const best = viableAds[0];

  if (best) {
    return solve({ rule: 'best_expected_value', scored, pick: best });
  }

  const fallback = safest({ scored });

  if (fallback) {
    return solve({ rule: 'safest_available', scored, pick: fallback });
  }

  return { kind: 'stop', reasoning: unscoredReasoning({ rule: 'no_viable_option', scored }) };
};
