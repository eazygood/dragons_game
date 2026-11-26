import type { AdAdvice } from '@bigbank-dragon/contracts';

import { formatChance, formatGold } from '../../../shared/format.ts';
import { playCopy } from '../play-copy.ts';
import styles from './AdviceBadge.module.css';

export const AdviceBadge = ({ advice }: { advice: AdAdvice }) => (
  <dl className={styles.badge}>
    <div className={styles.verdict} data-verdict={advice.verdict}>
      <dt className={styles.visuallyHidden}>{playCopy.board.verdictLabel}</dt>
      <dd>{playCopy.board.verdict[advice.verdict]}</dd>
    </div>
    <div>
      <dt>{playCopy.board.estimate}</dt>
      <dd>{formatChance({ winChance: advice.estimatedProbability })}</dd>
    </div>
    <div>
      <dt>{playCopy.board.expectedValue}</dt>
      <dd>{formatGold({ gold: advice.expectedValue })}</dd>
    </div>
  </dl>
);
