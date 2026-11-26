import type { GameState, ShopItem } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import { decide } from '../../domain/engine/decide.ts';
import type { MeasuredCalibration } from '../../domain/engine/calibration.ts';
import type { StrategyConfig } from '../../domain/engine/strategy-config.ts';
import type { BotStrategy } from '../../entities/bot-run.ts';
import type { GameRun } from '../../entities/game-run.ts';
import type { Logger } from '../../entities/logger.ts';
import { learnFromAttempt, loadCalibration } from '../calibration-manager/index.ts';
import { findAds, isOutOfLives } from '../game-manager/index.ts';
import { executeDecision } from './execute-decision.ts';

// Concurrent games in one benchmark write evidence too; a periodic re-read picks theirs up
// without a query per turn, and the game's own attempts are folded in between reads.
export const CALIBRATION_REFRESH_TURNS = 10;

// What a bot knows between turns. `calibration` grows with the game's own attempts and is
// replaced by a fresh read every CALIBRATION_REFRESH_TURNS turns.
export type BotRunProgress = {
  state: GameState;
  turns: number;
  calibration: MeasuredCalibration;
};

// Fixed for the whole game, unlike the progress.
export type BotGameContext = {
  db: Knex;
  run: GameRun;
  strategy: BotStrategy;
  /** Restricts calibration to one benchmark's games; null reads all history. */
  calibrationBenchmarkId: string | null;
  config: StrategyConfig;
  logger: Logger;
};

export type TurnOutcome = {
  status: 'played' | 'game_over' | 'stopped';
  progress: BotRunProgress;
};

const refreshCalibration = ({
  context,
  progress,
}: {
  context: BotGameContext;
  progress: BotRunProgress;
}): Promise<MeasuredCalibration> => {
  const isRefreshDue = progress.turns > 0 && progress.turns % CALIBRATION_REFRESH_TURNS === 0;

  if (!isRefreshDue) {
    return Promise.resolve(progress.calibration);
  }

  const { db, strategy, config, logger, calibrationBenchmarkId } = context;

  // A failed re-read must not throw away what this game has learned so far.
  return loadCalibration({
    db,
    strategy,
    config,
    logger,
    benchmarkId: calibrationBenchmarkId,
    fallback: progress.calibration,
  });
};

// Returns the progress after the turn and leaves the one it was given untouched, so a thrown
// error leaves the caller holding the last known state.
export const playTurn = async ({
  context,
  shop,
  progress,
}: {
  context: BotGameContext;
  shop: ShopItem[];
  progress: BotRunProgress;
}): Promise<TurnOutcome> => {
  const { db, run, strategy, config, logger } = context;
  const { state } = progress;
  const boardResult = await findAds({ gameId: run.gameId });

  if (boardResult.status === 'game_over') {
    return { status: 'game_over', progress };
  }

  const calibration = await refreshCalibration({ context, progress });

  const decision = decide({ state, board: boardResult.value, shop, calibration, config });

  logger.info({ gameId: run.gameId, turn: state.turn, decision }, 'decision');

  if (decision.kind === 'stop') {
    logger.info({ gameId: run.gameId, reasoning: decision.reasoning }, 'engine stopped');
    return { status: 'stopped', progress };
  }

  const executedResult = await executeDecision({
    context: { db, run, state, logger, onPersistFailure: 'keep_playing' },
    decision,
    board: boardResult.value,
    shop,
  });

  if (executedResult.status === 'game_over') {
    return { status: 'game_over', progress };
  }

  const { turn, persisted, attempt } = executedResult.value;
  // An attempt whose row was lost stays out, so the calibration never holds evidence the
  // table lacks and always equals what a fresh read would give.
  const nextCalibration =
    persisted && attempt ? learnFromAttempt({ strategy, calibration, attempt }) : calibration;

  return {
    status: isOutOfLives({ state: turn.state }) ? 'game_over' : 'played',
    progress: { state: turn.state, turns: progress.turns + 1, calibration: nextCalibration },
  };
};
