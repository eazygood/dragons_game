import { ProbabilityLabelSchema } from '@bigbank-dragon/contracts';

import type { DbExecutor } from '../adapters/mysql-adapter.ts';
import type { AdAttempt, CalibrationCount } from '../entities/ad-attempt.ts';
import { DbTables } from '../entities/db-tables.ts';

export interface AdAttemptRow {
  game_run_id: number;
  ad_id: string;
  probability: string;
  dragon_level: number;
  turn: number;
  reward: number;
  was_encrypted: boolean;
  success: boolean;
  estimated_probability: number;
  expected_value: number;
  created_at: Date;
}

interface CalibrationCountRow {
  probability: string;
  dragon_level: number;
  attempts: number | string;
  successes: number | string | null;
}

export const transform = ({ attempt }: { attempt: AdAttempt }): AdAttemptRow => ({
  game_run_id: attempt.gameRunId,
  ad_id: attempt.adId,
  probability: attempt.probability,
  dragon_level: attempt.dragonLevel,
  turn: attempt.turn,
  reward: attempt.reward,
  was_encrypted: attempt.wasEncrypted,
  success: attempt.success,
  estimated_probability: attempt.estimatedProbability,
  expected_value: attempt.expectedValue,
  created_at: attempt.createdAt,
});

// A label this build does not know would poison calibration, so it fails here.
const reverseTransform = ({ row }: { row: CalibrationCountRow }): CalibrationCount => ({
  probability: ProbabilityLabelSchema.parse(row.probability),
  dragonLevel: row.dragon_level,
  attempts: Number(row.attempts),
  successes: Number(row.successes ?? 0),
});

const createOne = async ({ db, attempt }: { db: DbExecutor; attempt: AdAttempt }) => {
  await db(DbTables.AdAttempts).insert(transform({ attempt }));
};

const findCalibrationCounts = async ({ db }: { db: DbExecutor }): Promise<CalibrationCount[]> => {
  const rows: CalibrationCountRow[] = await db(DbTables.AdAttempts)
    .select('probability', 'dragon_level')
    .count({ attempts: '*' })
    .sum({ successes: 'success' })
    .groupBy('probability', 'dragon_level');

  return rows.map((row) => reverseTransform({ row }));
};

const deleteMany = async ({ db }: { db: DbExecutor }) => {
  await db(DbTables.AdAttempts).delete();
};

export const adAttemptRepository = { createOne, findCalibrationCounts, deleteMany };
