import type { Knex } from 'knex';

import { playerChoiceReasoning } from '../../domain/engine/advise.ts';
import { STRATEGY_CONFIG } from '../../domain/engine/strategy-config.ts';
import type { Logger } from '../../entities/logger.ts';
import type { OrGameOver } from '../../entities/or-game-over.ts';
import type { PlayerMove } from '../../entities/turn-result.ts';
import { AdExpiredError } from '../../errors/errors.ts';
import { loadPlayerCalibration } from '../calibration-manager/index.ts';
import { findAds } from './board.ts';
import { playSolveTurn } from './play-solve-turn.ts';
import { withPlayerTurn } from './with-player-turn.ts';

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

      const calibration = await loadPlayerCalibration({ db, logger });
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
