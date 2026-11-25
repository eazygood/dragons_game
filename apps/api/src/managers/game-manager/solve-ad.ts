import type { Ad, GameState, ScoredReasoning } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { GameRun } from '../../entities/game-run.ts';
import type { TurnResult } from '../../entities/turn-result.ts';
import type { UpstreamResult } from '../../entities/upstream-result.ts';
import { adAttemptRepository } from '../../repositories/index.ts';
import { saveStateWithRecord } from './save-state-with-record.ts';

export const solveAd = async ({
  db,
  run,
  state,
  ad,
  reasoning,
}: {
  db: Knex;
  run: GameRun;
  state: GameState;
  ad: Ad;
  reasoning: ScoredReasoning;
}): Promise<UpstreamResult<TurnResult>> => {
  const solveResult = await adAttemptRepository.mugloar.createOne({
    gameId: run.gameId,
    adId: ad.adId,
  });

  if (solveResult.status === 'game_over') {
    return solveResult;
  }

  const outcome = solveResult.value;
  // solve never reports level; it only changes through a purchase.
  const nextState: GameState = {
    ...state,
    lives: outcome.lives,
    gold: outcome.gold,
    score: outcome.score,
    turn: outcome.turn,
  };

  const turnResult: TurnResult = {
    state: nextState,
    success: outcome.success,
    message: outcome.message,
  };

  await saveStateWithRecord({
    db,
    run,
    turnResult,
    writeRecord: (trx) =>
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

  return { status: 'ok', value: turnResult };
};
