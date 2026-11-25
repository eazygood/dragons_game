import type { GameState } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { Logger } from '../../config/logger.ts';
import { decide } from '../../domain/engine/decide.ts';
import { STRATEGY_CONFIG } from '../../domain/engine/strategy-config.ts';
import type { StrategyConfig } from '../../domain/engine/strategy-config.ts';
import type { BotRunResult, BotStrategy } from '../../entities/bot-run.ts';
import type { GameRun } from '../../entities/game-run.ts';
import { loadCalibration } from '../calibration-manager/index.ts';
import {
  findAds,
  findShopItems,
  finishRun,
  keepPlayingOnPersistenceFailure,
} from '../game-manager/index.ts';
import { executeDecision } from './execute-decision.ts';

// Far beyond any observed game; only a misbehaving upstream ever reaches it.
export const DEFAULT_MAX_TURNS = 1000;

export const SILENT_LOGGER: Logger = { info: () => undefined, warn: () => undefined };

type Progress = { state: GameState; turns: number; isGameOver: boolean };

type PlayGameInput = {
  db: Knex;
  run: GameRun;
  state: GameState;
  strategy: BotStrategy;
  /** Restricts calibration to one benchmark's games; null reads all history. */
  calibrationBenchmarkId: string | null;
  config?: StrategyConfig;
  logger: Logger;
  maxTurns?: number;
};

type PlayTurnsInput = Required<Omit<PlayGameInput, 'state'>> & { progress: Progress };

// Writes into `progress` as it goes, so a thrown error still leaves the last known state.
const playTurns = async ({
  db,
  run,
  progress,
  strategy,
  calibrationBenchmarkId,
  config,
  logger,
  maxTurns,
}: PlayTurnsInput) => {
  // Fetched once: the listing can differ between games, not within one.
  const shopResult = await findShopItems({ gameId: run.gameId });

  if (shopResult.status === 'game_over') {
    progress.isGameOver = true;
    return;
  }

  while (progress.turns < maxTurns) {
    const boardResult = await findAds({ gameId: run.gameId });

    if (boardResult.status === 'game_over') {
      progress.isGameOver = true;
      return;
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
    const decision = decide({
      state,
      board: boardResult.value,
      shop: shopResult.value,
      calibration,
      config,
    });

    logger.info({ gameId: run.gameId, turn: state.turn, decision }, 'decision');

    if (decision.kind === 'stop') {
      logger.info({ gameId: run.gameId, reasoning: decision.reasoning }, 'engine stopped');
      return;
    }

    const pendingTurn = executeDecision({
      context: { db, run, state },
      decision,
      board: boardResult.value,
      shop: shopResult.value,
    });
    const playedTurn = await keepPlayingOnPersistenceFailure({ pendingTurn, logger });

    if (playedTurn.status === 'game_over') {
      progress.isGameOver = true;
      return;
    }

    progress.state = playedTurn.value.state;
    progress.turns += 1;

    // Lives at zero already ended the game; asking for the next board would be a 410.
    if (playedTurn.value.state.lives <= 0) {
      progress.isGameOver = true;
      return;
    }
  }
};

export const playGame = async ({
  db,
  run,
  state,
  strategy,
  calibrationBenchmarkId,
  config = STRATEGY_CONFIG,
  logger,
  maxTurns = DEFAULT_MAX_TURNS,
}: PlayGameInput): Promise<BotRunResult> => {
  const progress: Progress = { state, turns: 0, isGameOver: false };

  try {
    await playTurns({
      db,
      run,
      progress,
      strategy,
      calibrationBenchmarkId,
      config,
      logger,
      maxTurns,
    });
  } catch (error) {
    // The upstream game outlives the error; without this the row stays 'active' forever.
    await finishRun({ db, run, state: progress.state, status: 'abandoned' }).catch(
      (finishError: unknown) => logger.warn({ err: finishError }, 'errored run not finalised'),
    );
    throw error;
  }

  // Stopping early leaves the upstream game alive, so it is abandoned, not over.
  const status = progress.isGameOver ? 'game_over' : 'abandoned';

  await finishRun({ db, run, state: progress.state, status });
  logger.info(
    { gameId: run.gameId, score: progress.state.score, turns: progress.turns },
    'run finished',
  );

  return { gameId: run.gameId, score: progress.state.score, turns: progress.turns, strategy };
};
