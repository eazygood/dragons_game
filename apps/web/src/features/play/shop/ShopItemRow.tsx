import type { ShopItem } from '@bigbank-dragon/contracts';
import { useId } from 'react';

import type { MoveActions } from '../move-actions/move-actions.ts';
import { playCopy } from '../play-copy.ts';
import styles from './ShopItemRow.module.css';

export const ShopItemRow = ({
  item,
  gold,
  moveActions,
}: {
  item: ShopItem;
  gold: number;
  moveActions: MoveActions;
}) => {
  const reasonId = useId();
  const missingGold = item.cost - gold;
  const isUnaffordable = missingGold > 0;

  return (
    <li className={styles.item}>
      <span className={styles.name}>{item.name}</span>
      <span>{playCopy.shop.cost(item.cost)}</span>
      <button
        type="button"
        aria-label={playCopy.shop.buyLabel(item.name)}
        aria-describedby={isUnaffordable ? reasonId : undefined}
        disabled={isUnaffordable || moveActions.isPending}
        onClick={() => moveActions.buy(item.id)}
      >
        {playCopy.shop.buy}
      </button>
      {isUnaffordable && (
        <span id={reasonId} className={styles.reason}>
          {playCopy.shop.needMoreGold(missingGold)}
        </span>
      )}
    </li>
  );
};
