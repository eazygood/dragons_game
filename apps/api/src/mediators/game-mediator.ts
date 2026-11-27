import type { GameView, Move, MoveResult, TurnView } from '@dragons-game/contracts';
import type { Knex } from 'knex';

import * as advisorManager from '../managers/advisor-manager.ts';
import * as gameManager from '../managers/game-manager/index.ts';
import type { Logger, OrGameOver } from '../types.ts';

const toMoveResult = ({
  playerMoveResult,
}: {
  playerMoveResult: OrGameOver<gameManager.PlayerMove>;
}): OrGameOver<MoveResult> => {
  if (playerMoveResult.status === 'game_over') {
    return playerMoveResult;
  }

  const { state, status, success, message } = playerMoveResult.value;

  return { status: 'ok', value: { game: { state, status }, success, message } };
};

export const startGame = async ({ db }: { db: Knex }): Promise<GameView> => {
  const { run } = await gameManager.startGameRun({ db, strategy: 'manual' });

  return gameManager.toGameView({ run });
};

// Reads only the database, so a finished game still answers 200 with its final state.
export const findGame = async ({ db, gameId }: { db: Knex; gameId: string }): Promise<GameView> =>
  gameManager.toGameView({ run: await gameManager.findRun({ db, gameId }) });

export const findMoves = ({ db, gameId }: { db: Knex; gameId: string }): Promise<Move[]> =>
  gameManager.findMoveHistory({ db, gameId });

export const findTurn = async ({
  db,
  gameId,
  logger,
}: {
  db: Knex;
  gameId: string;
  logger: Logger;
}): Promise<OrGameOver<TurnView>> => {
  const playerTurnResult = await advisorManager.adviseTurn({ db, gameId, logger });

  if (playerTurnResult.status === 'game_over') {
    return playerTurnResult;
  }

  const { run, board, shop, recommendation } = playerTurnResult.value;

  return {
    status: 'ok',
    value: { game: gameManager.toGameView({ run }), board, shop, recommendation },
  };
};

export const solveAd = async ({
  db,
  gameId,
  adId,
  logger,
}: {
  db: Knex;
  gameId: string;
  adId: string;
  logger: Logger;
}): Promise<OrGameOver<MoveResult>> =>
  toMoveResult({
    playerMoveResult: await gameManager.solvePlayerAd({ db, gameId, adId, logger }),
  });

export const buyItem = async ({
  db,
  gameId,
  itemId,
  logger,
}: {
  db: Knex;
  gameId: string;
  itemId: string;
  logger: Logger;
}): Promise<OrGameOver<MoveResult>> =>
  toMoveResult({
    playerMoveResult: await gameManager.buyPlayerItem({ db, gameId, itemId, logger }),
  });
