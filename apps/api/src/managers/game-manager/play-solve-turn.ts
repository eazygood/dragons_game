import type { Ad, ScoredReasoning } from '@dragons-game/contracts';

import type { OrGameOver } from '../../entities/or-game-over.ts';
import type { SavedTurn } from '../../entities/turn-result.ts';
import { adAttemptRepository } from '../../repositories/index.ts';
import { playMove } from './play-move.ts';
import type { MoveContext } from './play-move.ts';

export const playSolveTurn = ({
  context,
  ad,
  reasoning,
}: {
  context: MoveContext;
  ad: Ad;
  reasoning: ScoredReasoning;
}): Promise<OrGameOver<SavedTurn>> => {
  const { run, state } = context;

  return playMove({
    context,
    callUpstream: () =>
      adAttemptRepository.mugloar.createOne({ gameId: run.gameId, adId: ad.adId }),
    // solve never reports level; it only changes through a purchase.
    toTurnResult: ({ outcome }) => ({
      state: {
        ...state,
        lives: outcome.lives,
        gold: outcome.gold,
        score: outcome.score,
        turn: outcome.turn,
      },
      success: outcome.success,
      message: outcome.message,
    }),
    writeRecord: ({ outcome, trx }) =>
      adAttemptRepository.db.createOne({
        db: trx,
        attempt: {
          gameRunId: run.id,
          adId: ad.adId,
          probability: ad.probability,
          dragonLevel: state.dragonLevel,
          turn: outcome.turn,
          reward: ad.reward,
          success: outcome.success,
          estimatedProbability: reasoning.estimatedProbability,
          expectedValue: reasoning.expectedValue,
          rule: reasoning.rule,
          createdAt: new Date(),
        },
      }),
  });
};
