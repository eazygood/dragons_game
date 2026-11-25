import type { GameState } from '@bigbank-dragon/contracts';

import styles from './GameStatusBar.module.css';
import { sharedCopy } from './shared-copy.ts';

const STATUS_FIELDS = ['score', 'gold', 'lives', 'dragonLevel', 'turn'] as const;

export const GameStatusBar = ({ state }: { state: GameState }) => (
  <div role="group" aria-label={sharedCopy.status.label}>
    <dl className={styles.bar}>
      {STATUS_FIELDS.map((field) => (
        <div key={field} className={styles.field}>
          <dt>{sharedCopy.status[field]}</dt>
          <dd>{state[field]}</dd>
        </div>
      ))}
    </dl>
  </div>
);
