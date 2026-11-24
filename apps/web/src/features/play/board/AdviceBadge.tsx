import type { AdAdvice } from '@bigbank-dragon/contracts';

import { copy } from '../copy.ts';
import { formatGold, formatPercent } from '../format.ts';
import styles from './AdviceBadge.module.css';

export const AdviceBadge = ({ advice }: { advice: AdAdvice }) => (
  <dl className={styles.badge}>
    <div className={styles.verdict} data-verdict={advice.verdict}>
      <dt className={styles.visuallyHidden}>{copy.board.verdictLabel}</dt>
      <dd>{copy.board.verdict[advice.verdict]}</dd>
    </div>
    <div>
      <dt>{copy.board.estimate}</dt>
      <dd>{formatPercent({ probability: advice.estimatedProbability })}</dd>
    </div>
    <div>
      <dt>{copy.board.expectedValue}</dt>
      <dd>{formatGold({ gold: advice.expectedValue })}</dd>
    </div>
  </dl>
);
