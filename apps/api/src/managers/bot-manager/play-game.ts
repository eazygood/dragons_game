import type { GameState } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import { STRATEGY_CONFIG } from '../../domain/engine/strategy-config.ts';
import type { StrategyConfig } from '../../domain/engine/strategy-config.ts';
import type { BotRunResult, BotStrategy } from '../../entities/bot-run.ts';
import type { GameRun } from '../../entities/game-run.ts';
import type { Logger } from '../../entities/logger.ts';
import { AdExpiredError, UpstreamUnavailableError } from '../../errors/errors.ts';
import { findShopItems, finishRun } from '../game-manager/index.ts';
import { playTurn } from './play-turn.ts';
import type { PlayTurnInput, Progress } from './play-turn.ts';

// Far beyond any observed game; only a misbehaving upstream ever reaches it.
const DEFAULT_MAX_TURNS = 1000;

// A run of failures this long means the upstream is down, not hiccuping.
export const MAX_CONSECUTIVE_FAILED_TURNS = 3;

export const SILENT_LOGGER: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

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
  /** Stops before the next turn; the turn in flight completes and the run ends abandoned. */
  signal?: AbortSignal;
};

type PlayTurnsInput = Omit<PlayTurnInput, 'shop'> & { maxTurns: number; signal?: AbortSignal };

const isTurnFailureSurvivable = (error: unknown) =>
  error instanceof UpstreamUnavailableError || error instanceof AdExpiredError;

const playTurns = async ({ maxTurns, signal, ...turnInput }: PlayTurnsInput) => {
  const { run, progress, logger } = turnInput;
  // Fetched once: the listing can differ between games, not within one.
  const shopResult = await findShopItems({ gameId: run.gameId });

  if (shopResult.status === 'game_over') {
    progress.isGameOver = true;
    return;
  }

  let consecutiveFailedTurns = 0;

  while (progress.turns < maxTurns && !signal?.aborted) {
    try {
      const outcome = await playTurn({ ...turnInput, shop: shopResult.value });

      consecutiveFailedTurns = 0;

      if (outcome === 'game_over') {
        progress.isGameOver = true;
        return;
      }

      if (outcome === 'stopped') {
        return;
      }
    } catch (error) {
      consecutiveFailedTurns += 1;

      if (
        !isTurnFailureSurvivable(error) ||
        consecutiveFailedTurns >= MAX_CONSECUTIVE_FAILED_TURNS
      ) {
        throw error;
      }

      // The failed solve/buy is never retried (not idempotent): the next turn re-reads the
      // board, and its successful response re-syncs lives, gold, score and turn. Local state
      // may lag until then, and a lost purchase's dragon level cannot be recovered.
      logger.warn(
        { err: error, gameId: run.gameId, consecutiveFailedTurns },
        'turn failed; playing on',
      );
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
  signal,
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
      signal,
    });
  } catch (error) {
    // The upstream game outlives the error; without this the row stays 'active' forever.
    await finishRun({ db, run, state: progress.state, status: 'abandoned' }).catch(
      (finishError: unknown) =>
        logger.warn({ err: finishError, gameId: run.gameId }, 'errored run not finalised'),
    );
    throw error;
  }

  // Stopping early leaves the upstream game alive, so it is abandoned, not over.
  const status = progress.isGameOver ? 'game_over' : 'abandoned';

  // The game itself finished; a failed bookkeeping write leaves the row 'active' (a known
  // limit) but must not turn a finished game into an error or stop a benchmark.
  await finishRun({ db, run, state: progress.state, status }).catch((finishError: unknown) =>
    logger.warn({ err: finishError, gameId: run.gameId }, 'finished run not finalised'),
  );
  logger.info(
    { gameId: run.gameId, score: progress.state.score, turns: progress.turns },
    'run finished',
  );

  return { gameId: run.gameId, score: progress.state.score, turns: progress.turns, strategy };
};
