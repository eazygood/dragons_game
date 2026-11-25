import type { GameState, ShopItem } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import { decide } from '../../domain/engine/decide.ts';
import type { StrategyConfig } from '../../domain/engine/strategy-config.ts';
import type { BotStrategy } from '../../entities/bot-run.ts';
import type { GameRun } from '../../entities/game-run.ts';
import type { Logger } from '../../entities/logger.ts';
import { loadCalibration } from '../calibration-manager/index.ts';
import { findAds, isOutOfLives, keepPlayingOnPersistenceFailure } from '../game-manager/index.ts';
import { executeDecision } from './execute-decision.ts';

export type Progress = { state: GameState; turns: number; isGameOver: boolean };

export type TurnOutcome = 'played' | 'game_over' | 'stopped';

export type PlayTurnInput = {
  db: Knex;
  run: GameRun;
  progress: Progress;
  shop: ShopItem[];
  strategy: BotStrategy;
  calibrationBenchmarkId: string | null;
  config: StrategyConfig;
  logger: Logger;
};

// Writes into `progress` only once a turn is played, so a thrown error leaves the last known state.
export const playTurn = async ({
  db,
  run,
  progress,
  shop,
  strategy,
  calibrationBenchmarkId,
  config,
  logger,
}: PlayTurnInput): Promise<TurnOutcome> => {
  const boardResult = await findAds({ gameId: run.gameId });

  if (boardResult.status === 'game_over') {
    return 'game_over';
  }

  // Per turn, not per game: concurrent games' evidence counts as soon as it lands.
  const calibration = await loadCalibration({
    db,
    strategy,
    config,
    logger,
    benchmarkId: calibrationBenchmarkId,
  });
  const { state } = progress;
  const decision = decide({ state, board: boardResult.value, shop, calibration, config });

  logger.info({ gameId: run.gameId, turn: state.turn, decision }, 'decision');

  if (decision.kind === 'stop') {
    logger.info({ gameId: run.gameId, reasoning: decision.reasoning }, 'engine stopped');
    return 'stopped';
  }

  const pendingTurn = executeDecision({
    context: { db, run, state },
    decision,
    board: boardResult.value,
    shop,
  });
  const playedTurn = await keepPlayingOnPersistenceFailure({ pendingTurn, logger });

  if (playedTurn.status === 'game_over') {
    return 'game_over';
  }

  progress.state = playedTurn.value.state;
  progress.turns += 1;

  return isOutOfLives({ state: playedTurn.value.state }) ? 'game_over' : 'played';
};
