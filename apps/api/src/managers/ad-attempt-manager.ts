import type { Knex } from 'knex';

import type { CalibrationCount } from '../engine/calibration.ts';
import type { AdAttempt } from '../entities/ad-attempt.ts';
import type { GameRunId } from '../entities/game-run.ts';
import * as adAttemptRepository from '../repositories/ad-attempt-repository.ts';

// The one way other managers reach ad_attempts, so the table has a single owner even
// while every call only passes through.
export const createOne = ({ db, attempt }: { db: Knex; attempt: AdAttempt }): Promise<void> =>
  adAttemptRepository.createOne({ db, attempt });

export const findMany = ({
  db,
  gameRunId,
}: {
  db: Knex;
  gameRunId: GameRunId;
}): Promise<AdAttempt[]> => adAttemptRepository.findMany({ db, gameRunId });

export const findCalibrationCounts = ({
  db,
  benchmarkId,
}: {
  db: Knex;
  benchmarkId: string | null;
}): Promise<CalibrationCount[]> => adAttemptRepository.findCalibrationCounts({ db, benchmarkId });
