import type { ShopItem } from '@dragons-game/contracts';
import { useId } from 'react';

import type { MoveActions } from '../move-actions/move-actions.ts';
import { playCopy } from '../play-copy.ts';
import { ShopItemRow } from './ShopItemRow.tsx';
import styles from './ShopPanel.module.css';

export const ShopPanel = ({
  shop,
  gold,
  moveActions,
}: {
  shop: ShopItem[];
  gold: number;
  moveActions: MoveActions;
}) => {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId}>{playCopy.shop.title}</h2>
      {shop.length === 0 ? (
        <p>{playCopy.shop.empty}</p>
      ) : (
        <ul className={styles.list}>
          {shop.map((item) => (
            <ShopItemRow key={item.id} item={item} gold={gold} moveActions={moveActions} />
          ))}
        </ul>
      )}
    </section>
  );
};
