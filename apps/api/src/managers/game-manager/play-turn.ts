import type { Ad, GameState, Reasoning, ScoredReasoning, ShopItem } from '@dragons-game/contracts';
import type { Knex } from 'knex';

import type { GameRun } from '../../entities/game-run.ts';
import * as adAttemptRepository from '../../repositories/ad-attempt-repository.ts';
import * as mugloarRepository from '../../repositories/mugloar-repository.ts';
import * as purchaseRepository from '../../repositories/purchase-repository.ts';
import type { Logger, OrGameOver } from '../../types.ts';
import { saveStateWithRecord } from './turn-persistence.ts';
import type { OnPersistFailure, SavedTurn, TurnResult } from './turn-persistence.ts';

export type MoveContext = {
  db: Knex;
  run: GameRun;
  state: GameState;
  logger: Logger;
  onPersistFailure: OnPersistFailure;
};

// The shape every move shares: ask the upstream, turn its answer into the next state, and
// save that state with the move's record. Only what a move reports and records differs.
const playMove = async <Outcome>({
  context,
  callUpstream,
  toTurnResult,
  writeRecord,
}: {
  context: MoveContext;
  callUpstream: () => Promise<OrGameOver<Outcome>>;
  toTurnResult: ({ outcome }: { outcome: Outcome }) => TurnResult;
  writeRecord: ({ outcome, trx }: { outcome: Outcome; trx: Knex.Transaction }) => Promise<unknown>;
}): Promise<OrGameOver<SavedTurn>> => {
  const upstreamResult = await callUpstream();

  if (upstreamResult.status === 'game_over') {
    return upstreamResult;
  }

  const { db, run, logger, onPersistFailure } = context;
  const { value: outcome } = upstreamResult;
  const savedTurn = await saveStateWithRecord({
    db,
    run,
    logger,
    onPersistFailure,
    turnResult: toTurnResult({ outcome }),
    writeRecord: (trx) => writeRecord({ outcome, trx }),
  });

  return { status: 'ok', value: savedTurn };
};

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
    callUpstream: () => mugloarRepository.solveAd({ gameId: run.gameId, adId: ad.adId }),
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
      adAttemptRepository.createOne({
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

export const playBuyTurn = ({
  context,
  item,
  reasoning,
}: {
  context: MoveContext;
  item: ShopItem;
  reasoning: Reasoning;
}): Promise<OrGameOver<SavedTurn>> => {
  const { run, state } = context;

  return playMove({
    context,
    callUpstream: () => mugloarRepository.buyItem({ gameId: run.gameId, itemId: item.id }),
    // A failed purchase still burns a turn, but must not move the level.
    toTurnResult: ({ outcome }) => ({
      state: {
        ...state,
        lives: outcome.lives,
        gold: outcome.gold,
        turn: outcome.turn,
        dragonLevel: outcome.success ? outcome.level : state.dragonLevel,
      },
      success: outcome.success,
      message: null,
    }),
    writeRecord: ({ outcome, trx }) =>
      purchaseRepository.createOne({
        db: trx,
        purchase: {
          gameRunId: run.id,
          itemId: item.id,
          itemName: item.name,
          rule: reasoning.rule,
          cost: item.cost,
          turn: outcome.turn,
          success: outcome.success,
          createdAt: new Date(),
        },
      }),
  });
};
