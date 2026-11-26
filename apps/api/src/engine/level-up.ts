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

// Levelling up before 1000 lost games that would otherwise have reached it.
// Score never goes down, so once 1000 is reached, spending gold on levels can't lose it.
export const levelUpToBuy = ({
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

  const levelUpItem = cheapestLevelUp({ shop });

  if (!levelUpItem || state.gold - levelUpItem.cost < config.levelUpGoldReserve) {
    return undefined;
  }

  return levelUpItem;
};
