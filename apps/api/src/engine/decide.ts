import { HEALING_POTION_ID } from '@dragons-game/contracts';
import type {
  Ad,
  Decision,
  DecisionRule,
  GameState,
  Reasoning,
  ShopItem,
} from '@dragons-game/contracts';

import type { Calibration } from './calibration.ts';
import { levelUpToBuy } from './level-up.ts';
import { rankAttemptableAds } from './score-ads.ts';
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
  rankedAds,
}: {
  rule: DecisionRule;
  rankedAds: ScoredAd[];
}): Reasoning => ({
  rule,
  estimatedProbability: null,
  expectedValue: null,
  consideredCount: rankedAds.length,
});

const solveDecision = ({
  rule,
  rankedAds,
  chosenAd,
}: {
  rule: DecisionRule;
  rankedAds: ScoredAd[];
  chosenAd: ScoredAd;
}): Decision => ({
  kind: 'solve',
  adId: chosenAd.ad.adId,
  reasoning: {
    rule,
    estimatedProbability: chosenAd.estimatedProbability,
    expectedValue: chosenAd.expectedValue,
    consideredCount: rankedAds.length,
  },
});

const buyDecision = ({
  rule,
  rankedAds,
  item,
}: {
  rule: DecisionRule;
  rankedAds: ScoredAd[];
  item: ShopItem;
}): Decision => ({
  kind: 'buy',
  itemId: item.id,
  reasoning: unscoredReasoning({ rule, rankedAds }),
});

const pickSafest = ({ rankedAds }: { rankedAds: ScoredAd[] }) =>
  rankedAds.toSorted((left, right) => right.estimatedProbability - left.estimatedProbability)[0];

export const decide = ({ state, board, shop, calibration, config }: DecideInput): Decision => {
  const rankedAds = rankAttemptableAds({ board, state, calibration, config });
  const potion = shop.find((item) => item.id === HEALING_POTION_ID);

  // Lives, not gold, end the game, so gold goes to a potion once lives reach the floor.
  if (state.lives <= config.livesFloor && potion && state.gold >= potion.cost) {
    return buyDecision({ rule: 'survival_floor', rankedAds, item: potion });
  }

  const levelUpItem = levelUpToBuy({ state, shop, config });

  if (levelUpItem && rankedAds.length > 0) {
    return buyDecision({ rule: 'level_up', rankedAds, item: levelUpItem });
  }

  const viableAds = rankedAds.filter(
    (rankedAd) => rankedAd.estimatedProbability >= config.minimumProbability,
  );
  const bestViableAd = viableAds[0];

  if (bestViableAd) {
    return solveDecision({ rule: 'best_expected_value', rankedAds, chosenAd: bestViableAd });
  }

  const safestAd = pickSafest({ rankedAds });

  if (safestAd) {
    return solveDecision({ rule: 'safest_available', rankedAds, chosenAd: safestAd });
  }

  return {
    kind: 'stop',
    reasoning: unscoredReasoning({ rule: 'no_viable_option', rankedAds }),
  };
};
