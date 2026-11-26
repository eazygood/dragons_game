import type { Decision, TurnView } from '@bigbank-dragon/contracts';
import { useId } from 'react';

import { formatChance, formatGold } from '../../../shared/format.ts';
import { playCopy } from '../play-copy.ts';
import styles from './RecommendationBanner.module.css';

const describeAdvice = ({
  recommendation,
  turnView,
}: {
  recommendation: Decision;
  turnView: TurnView;
}) => {
  if (recommendation.kind === 'stop') {
    return null;
  }

  if (recommendation.kind === 'buy') {
    const item = turnView.shop.find(({ id }) => id === recommendation.itemId);

    return playCopy.advice.buy(item?.name ?? recommendation.itemId);
  }

  const ad = turnView.board.find(({ adId }) => adId === recommendation.adId);
  const { estimatedProbability, expectedValue } = recommendation.reasoning;
  const odds = playCopy.advice.odds({
    percent: formatChance({ winChance: estimatedProbability }),
    gold: formatGold({ gold: expectedValue }),
  });

  return `${playCopy.advice.solve(ad?.message ?? recommendation.adId)} ${odds}`;
};

export const RecommendationBanner = ({ turnView }: { turnView: TurnView }) => {
  const titleId = useId();
  const { recommendation } = turnView;
  const action = describeAdvice({ recommendation, turnView });

  return (
    <section className={styles.banner} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        {playCopy.advice.title}
      </h2>
      {action && <p className={styles.action}>{action}</p>}
      <p className={styles.rule}>{playCopy.rules[recommendation.reasoning.rule]}</p>
    </section>
  );
};
