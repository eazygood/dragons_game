import type { GameState, Reasoning, RunStatus } from '@dragons-game/contracts';
import type { Knex } from 'knex';

import { playerChoiceReasoning } from '../../engine/advise.ts';
import { STRATEGY_CONFIG } from '../../engine/strategy-config.ts';
import type { GameRun } from '../../entities/game-run.ts';
import {
  AdExpiredError,
  InsufficientGoldError,
  ShopItemNotFoundError,
} from '../../errors/errors.ts';
import type { Logger, OrGameOver } from '../../types.ts';
import * as calibrationManager from '../calibration-manager.ts';
import { findAds, findShopItems } from './board-and-shop.ts';
import { withGameLock } from './game-lock.ts';
import { findPlayableRun, recordGameOver } from './game-runs.ts';
import { isOutOfLives, stateFromRun } from './game-state.ts';
import { playBuyTurn, playSolveTurn } from './play-turn.ts';
import type { MoveContext } from './play-turn.ts';
import type { SavedTurn, TurnResult } from './turn-persistence.ts';

export type PlayerMove = TurnResult & { status: RunStatus };

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
    findListing: () => findAds({ gameId, logger }),
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
