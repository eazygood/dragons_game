import type { ShopItem } from '@bigbank-dragon/contracts';
import { useId } from 'react';

import { copy } from '../copy.ts';
import type { MoveControls } from '../moves/move-controls.ts';
import styles from './ShopPanel.module.css';

export const ShopPanel = ({
  shop,
  gold,
  moves,
}: {
  shop: ShopItem[];
  gold: number;
  moves: MoveControls;
}) => {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId}>{copy.shop.title}</h2>
      <ul className={styles.list}>
        {shop.map((item) => {
          const missingGold = item.cost - gold;

          return (
            <li key={item.id} className={styles.item}>
              <span className={styles.name}>{item.name}</span>
              <span>{copy.shop.cost(item.cost)}</span>
              <button
                type="button"
                aria-label={copy.shop.buyLabel(item.name)}
                disabled={missingGold > 0 || moves.isPending}
                onClick={() => moves.buy(item.id)}
              >
                {copy.shop.buy}
              </button>
              {missingGold > 0 && (
                <span className={styles.reason}>{copy.shop.needMoreGold(missingGold)}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
