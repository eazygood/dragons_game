import type { Decision, TurnView } from '@bigbank-dragon/contracts';
import { useId } from 'react';

import { copy } from '../copy.ts';
import { formatGold, formatPercent } from '../format.ts';
import styles from './RecommendationBanner.module.css';

const describeAction = ({ recommendation, turn }: { recommendation: Decision; turn: TurnView }) => {
  if (recommendation.kind === 'stop') {
    return null;
  }

  if (recommendation.kind === 'buy') {
    const item = turn.shop.find(({ id }) => id === recommendation.itemId);

    return copy.advice.buy(item?.name ?? recommendation.itemId);
  }

  const ad = turn.board.find(({ adId }) => adId === recommendation.adId);
  const { estimatedProbability, expectedValue } = recommendation.reasoning;
  const odds = copy.advice.odds(
    formatPercent({ probability: estimatedProbability }),
    formatGold({ gold: expectedValue }),
  );

  return `${copy.advice.solve(ad?.message ?? recommendation.adId)} ${odds}`;
};

export const RecommendationBanner = ({ turn }: { turn: TurnView }) => {
  const titleId = useId();
  const { recommendation } = turn;
  const action = describeAction({ recommendation, turn });

  return (
    <section className={styles.banner} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        {copy.advice.title}
      </h2>
      {action && <p className={styles.action}>{action}</p>}
      <p className={styles.rule}>{copy.rules[recommendation.reasoning.rule]}</p>
    </section>
  );
};
