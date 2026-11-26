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
import { isAttemptable, rankAttemptableAds, scoreAd } from './score-ads.ts';
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
  scoredAd,
  recommendation,
  config,
}: {
  scoredAd: ScoredAd;
  recommendation: Decision;
  config: StrategyConfig;
}): AdVerdict => {
  if (!isAttemptable({ ad: scoredAd.ad })) {
    return 'unattemptable';
  }

  if (recommendation.kind === 'solve' && recommendation.adId === scoredAd.ad.adId) {
    return 'recommended';
  }

  return scoredAd.estimatedProbability >= config.minimumProbability ? 'viable' : 'long_shot';
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
  const attemptableAds = rankAttemptableAds({ board, state, calibration, config });
  const unattemptableAds = board
    .filter((ad) => !isAttemptable({ ad }))
    .map((ad) => scoreAd({ ad, state, calibration, config }));
  const ads = [...attemptableAds, ...unattemptableAds].map((scoredAd) => ({
    ...scoredAd.ad,
    advice: {
      verdict: verdictFor({ scoredAd, recommendation, config }),
      estimatedProbability: scoredAd.estimatedProbability,
      expectedValue: scoredAd.expectedValue,
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
    consideredCount: rankAttemptableAds({ board, state, calibration, config }).length,
  };
};
