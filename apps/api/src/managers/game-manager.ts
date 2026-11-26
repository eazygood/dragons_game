import type {
  Ad,
  GameState,
  GameView,
  Move,
  Reasoning,
  RunStatus,
  ScoredReasoning,
  ShopItem,
  StrategyName,
} from '@dragons-game/contracts';
import type { Knex } from 'knex';

import { withTransaction } from '../adapters/mysql-adapter.ts';
import { playerChoiceReasoning } from '../engine/advise.ts';
import { STRATEGY_CONFIG } from '../engine/strategy-config.ts';
import type { AdAttempt } from '../entities/ad-attempt.ts';
import type { GameRun, GameRunPatch, NewGameRun } from '../entities/game-run.ts';
import type { Purchase } from '../entities/purchase.ts';
import {
  AdExpiredError,
  GameNotFoundError,
  GameNotPlayableError,
  InsufficientGoldError,
  PersistenceFailedError,
  ShopItemNotFoundError,
} from '../errors/errors.ts';
import * as adAttemptRepository from '../repositories/ad-attempt-repository.ts';
import * as gameRunRepository from '../repositories/game-run-repository.ts';
import * as mugloarRepository from '../repositories/mugloar-repository.ts';
import * as purchaseRepository from '../repositories/purchase-repository.ts';
import { discardOutcome } from '../tools/discard-outcome.ts';
import type { Logger, OrGameOver } from '../types.ts';
import * as calibrationManager from './calibration-manager.ts';

// `message` is the upstream's solve message; a purchase has none.
export type TurnResult = { state: GameState; success: boolean; message: string | null };

export type PlayerMove = TurnResult & { status: RunStatus };

// `persisted` is false when the turn's record could not be written: the upstream turn
// still happened, so the caller decides what a lost record means for it.
export type SavedTurn = { turn: TurnResult; persisted: boolean };

// What a lost record means depends on who plays. A bot carries its state in memory, so it
// logs and plays on. A player's next move rebuilds state from the row, so a lost write would
// carry a stale dragon level forward for good: the record may go, but the state must land.
export type OnPersistFailure = 'keep_playing' | 'save_state_only';

export type MoveContext = {
  db: Knex;
  run: GameRun;
  state: GameState;
  logger: Logger;
  onPersistFailure: OnPersistFailure;
};

const statePatch = ({ state }: { state: GameState }): GameRunPatch => ({
  lives: state.lives,
  gold: state.gold,
  dragonLevel: state.dragonLevel,
  turn: state.turn,
  score: state.score,
});

export const stateFromRun = ({ run }: { run: GameRun }): GameState => ({
  gameId: run.gameId,
  lives: run.lives,
  gold: run.gold,
  dragonLevel: run.dragonLevel,
  turn: run.turn,
  score: run.score,
});

export const toGameView = ({ run }: { run: GameRun }): GameView => ({
  state: stateFromRun({ run }),
  status: run.status,
});

// A move that takes the last life still returns 200 upstream; the next call would be a 410.
export const isOutOfLives = ({ state }: { state: GameState }): boolean => state.lives <= 0;

// What the game offers right now, read from the upstream: ads change every turn, and the shop
// can differ between games.
export const findAds = ({ gameId }: { gameId: string }): Promise<OrGameOver<Ad[]>> =>
  mugloarRepository.findAds({ gameId });

export const findShopItems = ({ gameId }: { gameId: string }): Promise<OrGameOver<ShopItem[]>> =>
  mugloarRepository.findShopItems({ gameId });

export const findRun = async ({ db, gameId }: { db: Knex; gameId: string }): Promise<GameRun> => {
  const run = await gameRunRepository.findOne({ db, gameId });

  if (!run) {
    throw new GameNotFoundError({ message: `Game ${gameId} not found` });
  }

  return run;
};

// A finished run answers game over without asking the upstream, which would say 410 anyway.
export const findPlayableRun = async ({
  db,
  gameId,
}: {
  db: Knex;
  gameId: string;
}): Promise<OrGameOver<GameRun>> => {
  const run = await findRun({ db, gameId });

  if (run.strategy !== 'manual') {
    throw new GameNotPlayableError({ message: `Game ${gameId} is played by the bot` });
  }

  if (run.status !== 'active') {
    return { status: 'game_over' };
  }

  return { status: 'ok', value: run };
};

export const startGameRun = async ({
  db,
  strategy,
  benchmarkId = null,
}: {
  db: Knex;
  strategy: StrategyName;
  benchmarkId?: string | null;
}): Promise<{ run: GameRun; state: GameState }> => {
  const snapshot = await mugloarRepository.startGame();
  const state: GameState = {
    gameId: snapshot.gameId,
    lives: snapshot.lives,
    gold: snapshot.gold,
    dragonLevel: snapshot.level,
    turn: snapshot.turn,
    score: snapshot.score,
  };
  const gameRun: NewGameRun = {
    ...state,
    strategy,
    benchmarkId,
    status: 'active',
    startedAt: new Date(),
    endedAt: null,
  };
  const id = await gameRunRepository.createOne({ db, gameRun });

  return { run: { ...gameRun, id }, state };
};

export const finishRun = async ({
  db,
  run,
  state,
  status,
}: {
  db: Knex;
  run: GameRun;
  state: GameState;
  status: Exclude<RunStatus, 'active'>;
}): Promise<void> => {
  await gameRunRepository.updateOne({
    db,
    id: run.id,
    patch: { ...statePatch({ state }), status, endedAt: new Date() },
  });
};

// The game is over upstream whatever happens here; a failed write must not turn
// that into a 500 for the player.
export const recordGameOver = async ({
  db,
  run,
  state = stateFromRun({ run }),
  logger,
}: {
  db: Knex;
  run: GameRun;
  state?: GameState;
  logger: Logger;
}): Promise<void> => {
  try {
    await finishRun({ db, run, state, status: 'game_over' });
  } catch (error) {
    logger.warn({ err: error, gameId: run.gameId }, 'could not mark run as game over');
  }
};

const toSolveMove = ({ attempt }: { attempt: AdAttempt }): Move => ({
  kind: 'solve',
  turn: attempt.turn,
  success: attempt.success,
  probability: attempt.probability,
  reward: attempt.reward,
  estimatedProbability: attempt.estimatedProbability,
  expectedValue: attempt.expectedValue,
  rule: attempt.rule,
});

const toBuyMove = ({ purchase }: { purchase: Purchase }): Move => ({
  kind: 'buy',
  turn: purchase.turn,
  success: purchase.success,
  itemName: purchase.itemName,
  cost: purchase.cost,
  rule: purchase.rule,
});

// Reads the database only, so a bot's game can be watched without touching the upstream.
export const findMoveHistory = async ({
  db,
  gameId,
}: {
  db: Knex;
  gameId: string;
}): Promise<Move[]> => {
  const run = await findRun({ db, gameId });
  const [attempts, purchases] = await Promise.all([
    adAttemptRepository.findMany({ db, gameRunId: run.id }),
    purchaseRepository.findMany({ db, gameRunId: run.id }),
  ]);

  return [
    ...attempts.map((attempt) => toSolveMove({ attempt })),
    ...purchases.map((purchase) => toBuyMove({ purchase })),
  ].sort((first, second) => second.turn - first.turn);
};

// One move per game at a time: a double click must not reach the upstream twice
// concurrently, and the second move must see the state the first one left.
const pendingTasksByGame = new Map<string, Promise<void>>();

export const withGameLock = <T>({
  gameId,
  task,
}: {
  gameId: string;
  task: () => Promise<T>;
}): Promise<T> => {
  const previousTask = pendingTasksByGame.get(gameId) ?? Promise.resolve();
  const currentTask = previousTask.then(task);
  const settled = currentTask.then(discardOutcome, discardOutcome);

  pendingTasksByGame.set(gameId, settled);
  void settled.then(() => {
    if (pendingTasksByGame.get(gameId) === settled) {
      pendingTasksByGame.delete(gameId);
    }
  });

  return currentTask;
};

type SaveInput = {
  db: Knex;
  run: GameRun;
  turnResult: TurnResult;
  logger: Logger;
};

const settleLostRecord = async ({
  db,
  run,
  turnResult,
  logger,
  cause,
  onPersistFailure,
}: SaveInput & { cause: unknown; onPersistFailure: OnPersistFailure }): Promise<SavedTurn> => {
  const { turn } = turnResult.state;
  const lostRecord: SavedTurn = { turn: turnResult, persisted: false };

  if (onPersistFailure === 'keep_playing') {
    logger.warn({ err: cause, turn }, 'turn not persisted; playing on');
    return lostRecord;
  }

  logger.warn({ err: cause, turn }, 'turn record not persisted; saving state only');

  try {
    await gameRunRepository.updateOne({
      db,
      id: run.id,
      patch: statePatch({ state: turnResult.state }),
    });
  } catch (fallbackError) {
    throw new PersistenceFailedError({
      message: `Could not save the state after turn ${turn} of game ${run.gameId}`,
      cause: fallbackError,
    });
  }

  return lostRecord;
};

// One transaction for the run's live state and the turn's record (ad attempt or
// purchase), so a failed record write rolls the state back and the two never disagree.
export const saveStateWithRecord = async ({
  writeRecord,
  onPersistFailure,
  ...input
}: SaveInput & {
  writeRecord: (trx: Knex.Transaction) => Promise<unknown>;
  onPersistFailure: OnPersistFailure;
}): Promise<SavedTurn> => {
  const { db, run, turnResult } = input;

  try {
    await withTransaction({
      db,
      callback: async (trx) => {
        await gameRunRepository.updateOne({
          db: trx,
          id: run.id,
          patch: statePatch({ state: turnResult.state }),
        });
        await writeRecord(trx);
      },
    });
  } catch (cause) {
    return settleLostRecord({ ...input, cause, onPersistFailure });
  }

  return { turn: turnResult, persisted: true };
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

const applyMoveOutcome = async ({
  db,
  run,
  playedTurn,
  logger,
}: {
  db: Knex;
  run: GameRun;
  playedTurn: OrGameOver<SavedTurn>;
  logger: Logger;
}): Promise<OrGameOver<PlayerMove>> => {
  if (playedTurn.status === 'game_over') {
    await recordGameOver({ db, run, logger });
    return playedTurn;
  }

  const { turn } = playedTurn.value;

  if (isOutOfLives({ state: turn.state })) {
    await recordGameOver({ db, run, state: turn.state, logger });
    return { status: 'ok', value: { ...turn, status: 'game_over' } };
  }

  return { status: 'ok', value: { ...turn, status: 'active' } };
};

// Everything a player's move does around the move itself: the lock, the playable run, the
// board or shop re-read, and settling a game that ended. `playTurn` holds what differs.
const withPlayerTurn = <Listing>({
  db,
  gameId,
  logger,
  findListing,
  playTurn,
}: {
  db: Knex;
  gameId: string;
  logger: Logger;
  findListing: ({ gameId }: { gameId: string }) => Promise<OrGameOver<Listing>>;
  playTurn: ({
    context,
    listing,
  }: {
    context: MoveContext;
    listing: Listing;
  }) => Promise<OrGameOver<SavedTurn>>;
}): Promise<OrGameOver<PlayerMove>> =>
  withGameLock({
    gameId,
    task: async () => {
      const playableRunResult = await findPlayableRun({ db, gameId });

      if (playableRunResult.status === 'game_over') {
        return playableRunResult;
      }

      const run: GameRun = playableRunResult.value;
      // The listing is re-read rather than trusted from the client: what it saw may have
      // gone, and a move on something gone is a 400 upstream.
      const listingResult = await findListing({ gameId });

      if (listingResult.status === 'game_over') {
        await recordGameOver({ db, run, logger });
        return listingResult;
      }

      const state: GameState = stateFromRun({ run });
      const playedTurn = await playTurn({
        context: { db, run, state, logger, onPersistFailure: 'save_state_only' },
        listing: listingResult.value,
      });

      return applyMoveOutcome({ db, run, playedTurn, logger });
    },
  });

export const solvePlayerAd = ({
  db,
  gameId,
  adId,
  logger,
}: {
  db: Knex;
  gameId: string;
  adId: string;
  logger: Logger;
}): Promise<OrGameOver<PlayerMove>> =>
  withPlayerTurn({
    db,
    gameId,
    logger,
    findListing: findAds,
    playTurn: async ({ context, listing: board }) => {
      const ad = board.find((candidate) => candidate.adId === adId);

      if (!ad) {
        throw new AdExpiredError({ message: `Ad ${adId} is no longer on the board` });
      }

      const calibration = await calibrationManager.loadPlayerCalibration({ db, logger });
      const reasoning = playerChoiceReasoning({
        ad,
        board,
        state: context.state,
        calibration,
        config: STRATEGY_CONFIG,
      });

      return playSolveTurn({ context, ad, reasoning });
    },
  });

export const buyPlayerItem = ({
  db,
  gameId,
  itemId,
  logger,
}: {
  db: Knex;
  gameId: string;
  itemId: string;
  logger: Logger;
}): Promise<OrGameOver<PlayerMove>> =>
  withPlayerTurn({
    db,
    gameId,
    logger,
    findListing: findShopItems,
    playTurn: ({ context, listing: shop }) => {
      const item = shop.find((candidate) => candidate.id === itemId);

      if (!item) {
        throw new ShopItemNotFoundError({ message: `Item ${itemId} is not in the shop` });
      }

      const { gold } = context.state;

      // A purchase the upstream refuses still burns a turn, so refuse it here first.
      if (gold < item.cost) {
        throw new InsufficientGoldError({
          message: `${item.name} costs ${item.cost} gold; you have ${gold}`,
        });
      }

      const reasoning: Reasoning = {
        rule: 'player_choice',
        estimatedProbability: null,
        expectedValue: null,
        consideredCount: shop.length,
      };

      return playBuyTurn({ context, item, reasoning });
    },
  });
