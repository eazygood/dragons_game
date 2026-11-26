import { HEALING_POTION_ID } from '@dragons-game/contracts';
import type { GameState, ShopItem } from '@dragons-game/contracts';

import { compareCodePoints } from './score-ads.ts';
import type { StrategyConfig } from './strategy-config.ts';

const cheapestLevelUp = ({ shop }: { shop: ShopItem[] }) =>
  shop
    .filter((item) => item.id !== HEALING_POTION_ID)
    .toSorted(
      (left, right) =>
        left.cost - right.cost || compareCodePoints({ left: left.id, right: right.id }),
    )[0];

// Score never falls within a game, so once it reaches the start score a level-up can
// no longer cost the target; it only spends a turn on making harder ads winnable.
export const affordableLevelUp = ({
  state,
  shop,
  config,
}: {
  state: GameState;
  shop: ShopItem[];
  config: StrategyConfig;
}): ShopItem | undefined => {
  if (config.levelUpFromScore === null || state.score < config.levelUpFromScore) {
    return undefined;
  }

  const item = cheapestLevelUp({ shop });

  if (!item || state.gold - item.cost < config.levelUpGoldReserve) {
    return undefined;
  }

  return item;
};
