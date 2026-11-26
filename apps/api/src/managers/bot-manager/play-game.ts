import type { GameState } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import { STRATEGY_CONFIG } from '../../domain/engine/strategy-config.ts';
import type { StrategyConfig } from '../../domain/engine/strategy-config.ts';
import type { BotRunResult, BotStrategy } from '../../entities/bot-run.ts';
import type { GameRun } from '../../entities/game-run.ts';
import type { Logger } from '../../entities/logger.ts';
import { AdExpiredError, UpstreamUnavailableError } from '../../errors/errors.ts';
import { loadCalibration } from '../calibration-manager/index.ts';
import { findShopItems, finishRun } from '../game-manager/index.ts';
import { playTurn } from './play-turn.ts';
import type { BotGameContext, BotRunProgress, TurnOutcome } from './play-turn.ts';

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

// 'stopped' covers every way a game ends while the upstream game is still alive.
type TurnsEnd = { progress: BotRunProgress; ending: Exclude<TurnOutcome['status'], 'played'> };

const isTurnFailureSurvivable = (error: unknown) =>
  error instanceof UpstreamUnavailableError || error instanceof AdExpiredError;

// The failed solve/buy is never retried (not idempotent): the next turn re-reads the board,
// and its successful response re-syncs lives, gold, score and turn. Local state may lag
// until then, and a lost purchase's dragon level cannot be recovered.
const tolerateFailedTurn = ({
  error,
  consecutiveFailedTurns,
  context,
}: {
  error: unknown;
  consecutiveFailedTurns: number;
  context: BotGameContext;
}) => {
  if (!isTurnFailureSurvivable(error) || consecutiveFailedTurns >= MAX_CONSECUTIVE_FAILED_TURNS) {
    throw error;
  }

  context.logger.warn(
    { err: error, gameId: context.run.gameId, consecutiveFailedTurns },
    'turn failed; playing on',
  );
};

const playUntilEnd = async ({
  context,
  progress: startProgress,
  maxTurns,
  signal,
}: {
  context: BotGameContext;
  progress: BotRunProgress;
  maxTurns: number;
  signal?: AbortSignal;
}): Promise<TurnsEnd> => {
  const { db, run, logger } = context;
  let progress = startProgress;

  try {
    // Fetched once: the listing can differ between games, not within one.
    const shopResult = await findShopItems({ gameId: run.gameId });

    if (shopResult.status === 'game_over') {
      return { progress, ending: 'game_over' };
    }

    let consecutiveFailedTurns = 0;

    while (progress.turns < maxTurns && !signal?.aborted) {
      try {
        const outcome = await playTurn({ context, shop: shopResult.value, progress });

        consecutiveFailedTurns = 0;
        progress = outcome.progress;

        if (outcome.status !== 'played') {
          return { progress, ending: outcome.status };
        }
      } catch (error) {
        consecutiveFailedTurns += 1;
        tolerateFailedTurn({ error, consecutiveFailedTurns, context });
      }
    }

    return { progress, ending: 'stopped' };
  } catch (error) {
    // The upstream game outlives the error; without this the row stays 'active' forever.
    await finishRun({ db, run, state: progress.state, status: 'abandoned' }).catch(
      (finishError: unknown) =>
        logger.warn({ err: finishError, gameId: run.gameId }, 'errored run not finalised'),
    );
    throw error;
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
  const calibration = await loadCalibration({
    db,
    strategy,
    config,
    logger,
    benchmarkId: calibrationBenchmarkId,
  });
  const { progress, ending } = await playUntilEnd({
    context: { db, run, strategy, calibrationBenchmarkId, config, logger },
    progress: { state, turns: 0, calibration },
    maxTurns,
    signal,
  });
  // Stopping early leaves the upstream game alive, so it is abandoned, not over.
  const status = ending === 'game_over' ? 'game_over' : 'abandoned';

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
