import type { Ad, Decision, GameState, ShopItem } from '@dragons-game/contracts';
import type { Knex } from 'knex';
import type { z } from 'zod';

import type { CalibrationAttempt, MeasuredCalibration } from '../engine/calibration.ts';
import { decide } from '../engine/decide.ts';
import { STRATEGY_CONFIG } from '../engine/strategy-config.ts';
import type { StrategyConfig } from '../engine/strategy-config.ts';
import { StrategyNameSchema } from '../entities/game-run.ts';
import type { GameRun } from '../entities/game-run.ts';
import { DecisionInvariantError } from '../errors/decision-invariant-error.ts';
import { AdExpiredError, UpstreamUnavailableError } from '../errors/errors.ts';
import type { Logger, OrGameOver } from '../types.ts';
import * as calibrationManager from './calibration-manager.ts';
import * as gameManager from './game-manager/index.ts';

// cli/ calls managers only, so the engine's config reaches it through here.
export { STRATEGY_CONFIG };
export type { StrategyConfig };

// The one declaration of the strategies a bot can play; the CLIs parse their arguments with it.
export const BotStrategySchema = StrategyNameSchema.exclude(['manual']);

export type BotStrategy = z.infer<typeof BotStrategySchema>;

export type BotRunResult = { gameId: string; score: number; turns: number; strategy: BotStrategy };

// Far beyond any observed game; only a misbehaving upstream ever reaches it.
const DEFAULT_MAX_TURNS = 1000;

// A run of failures this long means the upstream is down, not hiccuping.
export const MAX_CONSECUTIVE_FAILED_TURNS = 3;

// Concurrent games in one benchmark write evidence too; a periodic re-read picks theirs up
// without a query per turn, and the game's own attempts are folded in between reads.
export const CALIBRATION_REFRESH_TURNS = 10;

export const SILENT_LOGGER: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

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

type TurnOutcome = {
  status: 'played' | 'game_over' | 'stopped';
  progress: BotRunProgress;
};

// `attempt` is the calibration evidence a solve produced; a purchase produces none.
type ExecutedDecision = gameManager.SavedTurn & { attempt: CalibrationAttempt | null };

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

const executeDecision = async ({
  context,
  decision,
  board,
  shop,
}: {
  context: gameManager.MoveContext;
  decision: Exclude<Decision, { kind: 'stop' }>;
  board: Ad[];
  shop: ShopItem[];
}): Promise<OrGameOver<ExecutedDecision>> => {
  if (decision.kind === 'buy') {
    const item = shop.find((candidate) => candidate.id === decision.itemId);

    if (!item) {
      throw new DecisionInvariantError({
        message: `Decision names item ${decision.itemId}, which is not in the shop`,
      });
    }

    const boughtTurn = await gameManager.playBuyTurn({
      context,
      item,
      reasoning: decision.reasoning,
    });

    if (boughtTurn.status === 'game_over') {
      return boughtTurn;
    }

    return { status: 'ok', value: { ...boughtTurn.value, attempt: null } };
  }

  const ad = board.find((candidate) => candidate.adId === decision.adId);

  if (!ad) {
    throw new DecisionInvariantError({
      message: `Decision names ad ${decision.adId}, which is not on the board`,
    });
  }

  const solvedTurn = await gameManager.playSolveTurn({
    context,
    ad,
    reasoning: decision.reasoning,
  });

  if (solvedTurn.status === 'game_over') {
    return solvedTurn;
  }

  const { turn } = solvedTurn.value;

  return {
    status: 'ok',
    value: {
      ...solvedTurn.value,
      attempt: {
        probability: ad.probability,
        dragonLevel: context.state.dragonLevel,
        reward: ad.reward,
        success: turn.success,
      },
    },
  };
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
  return calibrationManager.loadCalibration({
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
  const boardResult = await gameManager.findAds({ gameId: run.gameId, logger });

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
    persisted && attempt
      ? calibrationManager.learnFromAttempt({ strategy, calibration, attempt })
      : calibration;

  return {
    status: gameManager.isOutOfLives({ state: turn.state }) ? 'game_over' : 'played',
    progress: { state: turn.state, turns: progress.turns + 1, calibration: nextCalibration },
  };
};

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
    const shopResult = await gameManager.findShopItems({ gameId: run.gameId });

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
    await gameManager
      .finishRun({ db, run, state: progress.state, status: 'abandoned' })
      .catch((finishError: unknown) =>
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
  const calibration = await calibrationManager.loadCalibration({
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
  await gameManager
    .finishRun({ db, run, state: progress.state, status })
    .catch((finishError: unknown) =>
      logger.warn({ err: finishError, gameId: run.gameId }, 'finished run not finalised'),
    );
  logger.info(
    { gameId: run.gameId, score: progress.state.score, turns: progress.turns },
    'run finished',
  );

  return { gameId: run.gameId, score: progress.state.score, turns: progress.turns, strategy };
};

// The CLIs' whole game. bot-mediator cannot use it: it answers with the new run before the
// game is played, so it starts the run and calls playGame itself.
export const playNewGame = async ({
  db,
  strategy,
  benchmarkId = null,
  calibrationBenchmarkId = null,
  config,
  logger = SILENT_LOGGER,
  maxTurns,
}: {
  db: Knex;
  strategy: BotStrategy;
  benchmarkId?: string | null;
  /** Restricts calibration to one benchmark's games; null reads all history. */
  calibrationBenchmarkId?: string | null;
  config?: StrategyConfig;
  logger?: Logger;
  maxTurns?: number;
}): Promise<BotRunResult> => {
  const { run, state } = await gameManager.startGameRun({ db, strategy, benchmarkId });

  return playGame({ db, run, state, strategy, calibrationBenchmarkId, config, logger, maxTurns });
};
