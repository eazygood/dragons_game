import type { GameState } from '@bigbank-dragon/contracts';

import { copy } from '../copy.ts';
import styles from './GameStatusBar.module.css';

const STATUS_FIELDS = ['score', 'gold', 'lives', 'dragonLevel', 'turn'] as const;

export const GameStatusBar = ({ state }: { state: GameState }) => (
  <dl className={styles.bar} aria-label={copy.status.label}>
    {STATUS_FIELDS.map((field) => (
      <div key={field} className={styles.field}>
        <dt>{copy.status[field]}</dt>
        <dd>{state[field]}</dd>
      </div>
    ))}
  </dl>
);
