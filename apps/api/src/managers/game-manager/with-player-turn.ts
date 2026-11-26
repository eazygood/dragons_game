import type { GameState } from '@dragons-game/contracts';
import type { Knex } from 'knex';

import type { GameRun } from '../../entities/game-run.ts';
import type { Logger } from '../../entities/logger.ts';
import type { OrGameOver } from '../../entities/or-game-over.ts';
import type { PlayerMove, SavedTurn } from '../../entities/turn-result.ts';
import { applyMoveOutcome } from './apply-move-outcome.ts';
import { findPlayableRun } from './find-run.ts';
import { withGameLock } from './game-lock.ts';
import type { MoveContext } from './play-move.ts';
import { recordGameOver } from './record-game-over.ts';
import { stateFromRun } from './run-state.ts';

// Everything a player's move does around the move itself: the lock, the playable run, the
// board or shop re-read, and settling a game that ended. `playTurn` holds what differs.
export const withPlayerTurn = <Listing>({
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
