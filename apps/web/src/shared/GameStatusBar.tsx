import type { GameState } from '@dragons-game/contracts';

import styles from './GameStatusBar.module.css';
import { RefreshHint } from './RefreshHint.tsx';
import { sharedCopy } from './shared-copy.ts';

const STATUS_FIELDS = ['score', 'gold', 'lives', 'dragonLevel', 'turn'] as const;

type GameStatusBarProps = {
  state: GameState;
  hasRefreshFailed: boolean;
};

export const GameStatusBar = ({ state, hasRefreshFailed }: GameStatusBarProps) => (
  <div role="group" aria-label={sharedCopy.status.label}>
    <dl className={styles.bar}>
      {STATUS_FIELDS.map((field) => (
        <div key={field} className={styles.field}>
          <dt>{sharedCopy.status[field]}</dt>
          <dd>{state[field]}</dd>
        </div>
      ))}
    </dl>
    <RefreshHint hasFailed={hasRefreshFailed} />
  </div>
);
