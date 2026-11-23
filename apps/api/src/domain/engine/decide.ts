import { HEALING_POTION_ID } from '@bigbank-dragon/contracts';
import type { Ad, Decision, DecisionRule, GameState, ShopItem } from '@bigbank-dragon/contracts';

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

const reasoningFor = ({
  rule,
  scored,
  pick,
}: {
  rule: DecisionRule;
  scored: ScoredAd[];
  pick?: ScoredAd;
}) => ({
  rule,
  estimatedProbability: pick?.estimatedProbability ?? null,
  expectedValue: pick?.expectedValue ?? null,
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
  reasoning: reasoningFor({ rule, scored }),
});

// Lowest id among equal costs keeps benchmark runs reproducible.
const cheapestLevelUp = ({ shop }: { shop: ShopItem[] }) =>
  shop
    .filter((item) => item.id !== HEALING_POTION_ID)
    .toSorted((left, right) => left.cost - right.cost || left.id.localeCompare(right.id))[0];

const safest = ({ scored }: { scored: ScoredAd[] }) =>
  scored.toSorted((left, right) => right.estimatedProbability - left.estimatedProbability)[0];

const shouldLevelUp = ({
  state,
  item,
  hasGoodAd,
  config,
}: {
  state: GameState;
  item: ShopItem;
  hasGoodAd: boolean;
  config: StrategyConfig;
}) => {
  if (!config.levelUpEnabled || state.gold < item.cost) {
    return false;
  }

  return !hasGoodAd || state.gold - item.cost >= config.levelUpGoldReserve;
};

export const decide = ({ state, board, shop, calibration, config }: DecideInput): Decision => {
  const scored = scoreAds({ board, state, calibration, config });
  const potion = shop.find((item) => item.id === HEALING_POTION_ID);

  // Lives, not gold, end the game: a measured long run scored 6840, a short one 467.
  if (state.lives <= config.livesFloor && potion && state.gold >= potion.cost) {
    return buy({ rule: 'survival_floor', scored, item: potion });
  }

  const good = scored.filter((entry) => entry.estimatedProbability >= config.minimumProbability);
  const levelUp = cheapestLevelUp({ shop });

  if (levelUp && shouldLevelUp({ state, item: levelUp, hasGoodAd: good.length > 0, config })) {
    return buy({ rule: 'level_up', scored, item: levelUp });
  }

  const best = good[0];

  if (best) {
    return solve({ rule: 'best_expected_value', scored, pick: best });
  }

  const fallback = safest({ scored });

  if (fallback) {
    return solve({ rule: 'safest_available', scored, pick: fallback });
  }

  // Late boards turn all-Impossible; levelling up is the only spend that keeps
  // the game going, so it applies even when level-ups are otherwise disabled.
  if (levelUp && state.gold >= levelUp.cost) {
    return buy({ rule: 'level_up', scored, item: levelUp });
  }

  return { kind: 'stop', reasoning: reasoningFor({ rule: 'no_viable_option', scored }) };
};
