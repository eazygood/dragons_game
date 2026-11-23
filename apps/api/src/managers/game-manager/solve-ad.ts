import type { Ad, GameState, ScoredReasoning } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { MugloarClient, UpstreamResult } from '../../adapters/mugloar-api-adapter/index.ts';
import type { GameRun } from '../../entities/game-run.ts';
import { adAttemptRepository } from '../../repositories/index.ts';
import { persistTurn } from './persist-turn.ts';

export const solveAd = async ({
  db,
  client,
  run,
  state,
  ad,
  reasoning,
}: {
  db: Knex;
  client: MugloarClient;
  run: GameRun;
  state: GameState;
  ad: Ad;
  reasoning: ScoredReasoning;
}): Promise<UpstreamResult<GameState>> => {
  const result = await client.solveAd({ gameId: run.gameId, adId: ad.adId });

  if (result.status === 'game_over') {
    return result;
  }

  const outcome = result.value;
  // solve never reports level; it only changes through a purchase.
  const next: GameState = {
    ...state,
    lives: outcome.lives,
    gold: outcome.gold,
    score: outcome.score,
    turn: outcome.turn,
  };

  await persistTurn({
    db,
    run,
    state: next,
    record: (trx) =>
      adAttemptRepository.createOne({
        db: trx,
        attempt: {
          gameRunId: run.id,
          adId: ad.adId,
          probability: ad.probability,
          dragonLevel: state.dragonLevel,
          turn: outcome.turn,
          reward: ad.reward,
          wasEncrypted: ad.wasEncrypted,
          success: outcome.success,
          estimatedProbability: reasoning.estimatedProbability,
          expectedValue: reasoning.expectedValue,
          createdAt: new Date(),
        },
      }),
  });

  return { status: 'ok', value: next };
};
