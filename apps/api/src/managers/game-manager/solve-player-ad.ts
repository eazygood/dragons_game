import type { Knex } from 'knex';

import type { Logger } from '../../config/logger.ts';
import { playerChoiceReasoning } from '../../domain/engine/advise.ts';
import { STRATEGY_CONFIG } from '../../domain/engine/strategy-config.ts';
import type { PlayerMove } from '../../entities/turn-result.ts';
import type { UpstreamResult } from '../../entities/upstream-result.ts';
import { AdExpiredError } from '../../errors/errors.ts';
import { loadCalibration } from '../calibration-manager/index.ts';
import { endRun } from './end-run.ts';
import { findAds } from './find-ads.ts';
import { findPlayableRun } from './find-run.ts';
import { withGameLock } from './game-lock.ts';
import { keepPlayingOnPersistenceFailure } from './keep-playing.ts';
import { settleMove } from './settle-move.ts';
import { solveAd } from './solve-ad.ts';
import { stateFromRun } from './state-patch.ts';

// The board is re-read rather than trusted from the client: an ad the client saw
// may have expired, and solving it upstream would be a 400.
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
}): Promise<UpstreamResult<PlayerMove>> =>
  withGameLock({
    gameId,
    task: async () => {
      const playableRun = await findPlayableRun({ db, gameId });

      if (playableRun.status === 'game_over') {
        return playableRun;
      }

      const run = playableRun.value;
      const board = await findAds({ gameId });

      if (board.status === 'game_over') {
        await endRun({ db, run, logger });
        return board;
      }

      const ad = board.value.find((candidate) => candidate.adId === adId);

      if (!ad) {
        throw new AdExpiredError({ message: `Ad ${adId} is no longer on the board` });
      }

      const state = stateFromRun({ run });
      const config = STRATEGY_CONFIG;
      const calibration = await loadCalibration({
        db,
        strategy: 'calibrated',
        config,
        logger,
        benchmarkId: null,
      });
      const reasoning = playerChoiceReasoning({
        ad,
        board: board.value,
        state,
        calibration,
        config,
      });
      const action = solveAd({ db, run, state, ad, reasoning });
      const result = await keepPlayingOnPersistenceFailure({ action, logger });

      return settleMove({ db, run, result, logger });
    },
  });
