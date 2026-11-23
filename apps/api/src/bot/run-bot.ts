import type { GameState } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { MugloarClient } from '../adapters/mugloar-api-adapter/index.ts';
import { decide } from '../domain/engine/decide.ts';
import { STRATEGY_CONFIG } from '../domain/engine/strategy-config.ts';
import type { StrategyConfig } from '../domain/engine/strategy-config.ts';
import type { GameRun } from '../entities/game-run.ts';
import { finishRun, startGame } from '../managers/game-manager/index.ts';
import { execute, keepPlayingOnPersistenceFailure } from './execute-decision.ts';
import { loadCalibration } from './load-calibration.ts';
import type { BotLogger, BotRunResult, BotStrategy } from './types.ts';

// Far beyond any observed game; only a misbehaving upstream ever reaches it.
export const DEFAULT_MAX_TURNS = 1000;

export const SILENT_LOGGER: BotLogger = { info: () => undefined, warn: () => undefined };

type Progress = { state: GameState; turns: number; gameOver: boolean };

type PlayInput = {
  db: Knex;
  client: MugloarClient;
  run: GameRun;
  progress: Progress;
  strategy: BotStrategy;
  calibrationBenchmarkId: string | null;
  config: StrategyConfig;
  logger: BotLogger;
  maxTurns: number;
};

// Writes into `progress` as it goes, so a thrown error still leaves the last known state.
const play = async ({
  db,
  client,
  run,
  progress,
  strategy,
  calibrationBenchmarkId,
  config,
  logger,
  maxTurns,
}: PlayInput) => {
  // Fetched once: the listing can differ between games, not within one.
  const shop = await client.fetchShop({ gameId: run.gameId });

  if (shop.status === 'game_over') {
    progress.gameOver = true;
    return;
  }

  while (progress.turns < maxTurns) {
    const board = await client.fetchAds({ gameId: run.gameId });

    if (board.status === 'game_over') {
      progress.gameOver = true;
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
    const decision = decide({ state, board: board.value, shop: shop.value, calibration, config });

    logger.info({ gameId: run.gameId, turn: state.turn, decision }, 'decision');

    if (decision.kind === 'stop') {
      logger.info({ gameId: run.gameId, reasoning: decision.reasoning }, 'engine stopped');
      return;
    }

    const action = execute({
      context: { db, client, run, state },
      decision,
      board: board.value,
      shop: shop.value,
    });
    const result = await keepPlayingOnPersistenceFailure({ action, logger });

    if (result.status === 'game_over') {
      progress.gameOver = true;
      return;
    }

    progress.state = result.value;
    progress.turns += 1;

    // Lives at zero already ended the game; asking for the next board would be a 410.
    if (result.value.lives <= 0) {
      progress.gameOver = true;
      return;
    }
  }
};

export const runBot = async ({
  db,
  client,
  strategy,
  benchmarkId = null,
  calibrationBenchmarkId = null,
  config = STRATEGY_CONFIG,
  logger = SILENT_LOGGER,
  maxTurns = DEFAULT_MAX_TURNS,
}: {
  db: Knex;
  client: MugloarClient;
  strategy: BotStrategy;
  benchmarkId?: string | null;
  /** Restricts calibration to one benchmark's games; null reads all history. */
  calibrationBenchmarkId?: string | null;
  config?: StrategyConfig;
  logger?: BotLogger;
  maxTurns?: number;
}): Promise<BotRunResult> => {
  const { run, state } = await startGame({ db, client, strategy, benchmarkId });
  const progress: Progress = { state, turns: 0, gameOver: false };

  try {
    await play({
      db,
      client,
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
  const status = progress.gameOver ? 'game_over' : 'abandoned';

  await finishRun({ db, run, state: progress.state, status });
  logger.info(
    { gameId: run.gameId, score: progress.state.score, turns: progress.turns },
    'run finished',
  );

  return { gameId: run.gameId, score: progress.state.score, turns: progress.turns, strategy };
};
