import type {
  Ad,
  AdVerdict,
  AdvisedAd,
  Decision,
  GameState,
  ScoredReasoning,
  ShopItem,
} from '@dragons-game/contracts';

import type { Calibration } from './calibration.ts';
import { decide } from './decide.ts';
import { isAttemptable, scoreAd, scoreAds } from './score-ads.ts';
import type { ScoredAd } from './score-ads.ts';
import type { StrategyConfig } from './strategy-config.ts';

type AdviseInput = {
  state: GameState;
  board: Ad[];
  shop: ShopItem[];
  calibration: Calibration;
  config: StrategyConfig;
};

const verdictFor = ({
  scored,
  recommendation,
  config,
}: {
  scored: ScoredAd;
  recommendation: Decision;
  config: StrategyConfig;
}): AdVerdict => {
  if (!isAttemptable({ ad: scored.ad })) {
    return 'unattemptable';
  }

  if (recommendation.kind === 'solve' && recommendation.adId === scored.ad.adId) {
    return 'recommended';
  }

  return scored.estimatedProbability >= config.minimumProbability ? 'viable' : 'long_shot';
};

// The recommendation is decide() itself, so the advisor and the bot cannot disagree.
export const adviseBoard = ({
  state,
  board,
  shop,
  calibration,
  config,
}: AdviseInput): { recommendation: Decision; ads: AdvisedAd[] } => {
  const recommendation = decide({ state, board, shop, calibration, config });
  const attemptable = scoreAds({ board, state, calibration, config });
  const unattemptable = board
    .filter((ad) => !isAttemptable({ ad }))
    .map((ad) => scoreAd({ ad, state, calibration, config }));
  const ads = [...attemptable, ...unattemptable].map((scored) => ({
    ...scored.ad,
    advice: {
      verdict: verdictFor({ scored, recommendation, config }),
      estimatedProbability: scored.estimatedProbability,
      expectedValue: scored.expectedValue,
    },
  }));

  return { recommendation, ads };
};

// A human may pick an ad the engine would never solve; ad_attempts still records its estimate.
export const playerChoiceReasoning = ({
  ad,
  board,
  state,
  calibration,
  config,
}: Omit<AdviseInput, 'shop'> & { ad: Ad }): ScoredReasoning => {
  const { estimatedProbability, expectedValue } = scoreAd({ ad, state, calibration, config });

  return {
    rule: 'player_choice',
    estimatedProbability,
    expectedValue,
    consideredCount: scoreAds({ board, state, calibration, config }).length,
  };
};
