import type { Ad, Decision, GameState, ShopItem } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { MugloarClient, UpstreamResult } from '../adapters/mugloar-api-adapter/index.ts';
import { decide } from '../domain/engine/decide.ts';
import { STRATEGY_CONFIG } from '../domain/engine/strategy-config.ts';
import type { StrategyConfig } from '../domain/engine/strategy-config.ts';
import type { GameRun } from '../entities/game-run.ts';
import { PersistenceFailedError } from '../errors/errors.ts';
import { buyItem, finishRun, solveAd, startGame } from '../managers/game-manager/index.ts';
import { loadCalibration } from './load-calibration.ts';
import type { BotLogger, BotRunResult, BotStrategy } from './types.ts';

// Far beyond any observed game; only a misbehaving upstream ever reaches it.
export const DEFAULT_MAX_TURNS = 1000;

export const SILENT_LOGGER: BotLogger = { info: () => undefined, warn: () => undefined };

type TurnContext = { db: Knex; client: MugloarClient; run: GameRun; state: GameState };

const execute = ({
  context,
  decision,
  board,
  shop,
}: {
  context: TurnContext;
  decision: Exclude<Decision, { kind: 'stop' }>;
  board: Ad[];
  shop: ShopItem[];
}): Promise<UpstreamResult<GameState>> => {
  if (decision.kind === 'solve') {
    const ad = board.find((candidate) => candidate.adId === decision.adId);

    if (!ad) {
      throw new Error(`Decision names ad ${decision.adId}, which is not on the board`);
    }

    return solveAd({ ...context, ad, reasoning: decision.reasoning });
  }

  const item = shop.find((candidate) => candidate.id === decision.itemId);

  if (!item) {
    throw new Error(`Decision names item ${decision.itemId}, which is not in the shop`);
  }

  return buyItem({ ...context, item });
};

// The one error a game outlives (spec §6): the upstream turn already happened,
// so losing its local record must not end the real game.
const keepPlayingOnPersistenceFailure = async ({
  action,
  logger,
}: {
  action: Promise<UpstreamResult<GameState>>;
  logger: BotLogger;
}): Promise<UpstreamResult<GameState>> => {
  try {
    return await action;
  } catch (error) {
    if (!(error instanceof PersistenceFailedError)) {
      throw error;
    }

    logger.warn({ err: error, turn: error.state.turn }, 'turn not persisted; playing on');
    return { status: 'ok', value: error.state };
  }
};

export const runBot = async ({
  db,
  client,
  strategy,
  benchmarkId = null,
  config = STRATEGY_CONFIG,
  logger = SILENT_LOGGER,
  maxTurns = DEFAULT_MAX_TURNS,
}: {
  db: Knex;
  client: MugloarClient;
  strategy: BotStrategy;
  benchmarkId?: string | null;
  config?: StrategyConfig;
  logger?: BotLogger;
  maxTurns?: number;
}): Promise<BotRunResult> => {
  const started = await startGame({ db, client, strategy, benchmarkId });
  const { run } = started;
  let { state } = started;
  let turns = 0;
  let gameOver = false;

  // Fetched once: the listing can differ between games, not within one.
  const shop = await client.fetchShop({ gameId: run.gameId });

  while (shop.status === 'ok' && turns < maxTurns) {
    const board = await client.fetchAds({ gameId: run.gameId });

    if (board.status === 'game_over') {
      gameOver = true;
      break;
    }

    // Per turn, not per game: concurrent games' evidence counts as soon as it lands.
    const calibration = await loadCalibration({ db, strategy, config, logger });
    const decision = decide({ state, board: board.value, shop: shop.value, calibration, config });

    logger.info({ gameId: run.gameId, turn: state.turn, decision }, 'decision');

    if (decision.kind === 'stop') {
      logger.info({ gameId: run.gameId, reasoning: decision.reasoning }, 'engine stopped');
      break;
    }

    const action = execute({
      context: { db, client, run, state },
      decision,
      board: board.value,
      shop: shop.value,
    });
    const result = await keepPlayingOnPersistenceFailure({ action, logger });

    if (result.status === 'game_over') {
      gameOver = true;
      break;
    }

    state = result.value;
    turns += 1;

    // Lives at zero already ended the game; asking for the next board would be a 410.
    if (state.lives <= 0) {
      gameOver = true;
      break;
    }
  }

  gameOver ||= shop.status === 'game_over';
  // Stopping early leaves the upstream game alive, so it is abandoned, not over.
  await finishRun({ db, run, state, status: gameOver ? 'game_over' : 'abandoned' });
  logger.info({ gameId: run.gameId, score: state.score, turns }, 'run finished');

  return { gameId: run.gameId, score: state.score, turns, strategy };
};
