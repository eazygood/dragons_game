import type { Knex } from 'knex';

import type { Logger } from '../../config/logger.ts';
import { playerChoiceReasoning } from '../../domain/engine/advise.ts';
import { STRATEGY_CONFIG } from '../../domain/engine/strategy-config.ts';
import type { PlayerMove } from '../../entities/turn-result.ts';
import type { UpstreamResult } from '../../entities/upstream-result.ts';
import { AdExpiredError } from '../../errors/errors.ts';
import { loadCalibration } from '../calibration-manager/index.ts';
import { recordGameOver } from './record-game-over.ts';
import { findAds } from './find-ads.ts';
import { findPlayableRun } from './find-run.ts';
import { withGameLock } from './game-lock.ts';
import { keepPlayingOnPersistenceFailure } from './keep-playing.ts';
import { applyMoveOutcome } from './apply-move-outcome.ts';
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
      const playableRunResult = await findPlayableRun({ db, gameId });

      if (playableRunResult.status === 'game_over') {
        return playableRunResult;
      }

      const run = playableRunResult.value;
      const boardResult = await findAds({ gameId });

      if (boardResult.status === 'game_over') {
        await recordGameOver({ db, run, logger });
        return boardResult;
      }

      const ad = boardResult.value.find((candidate) => candidate.adId === adId);

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
        board: boardResult.value,
        state,
        calibration,
        config,
      });
      const pendingTurn = solveAd({ db, run, state, ad, reasoning });
      const playedTurn = await keepPlayingOnPersistenceFailure({ pendingTurn, logger });

      return applyMoveOutcome({ db, run, playedTurn, logger });
    },
  });
