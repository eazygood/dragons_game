import type { DecisionRule } from '@bigbank-dragon/contracts';
import { DecisionRuleSchema, ProbabilityLabelSchema } from '@bigbank-dragon/contracts';

import type { DbExecutor } from '../../adapters/mysql-adapter.ts';
import type { CalibrationCount } from '../../domain/engine/calibration.ts';
import type { AdAttempt } from '../../entities/ad-attempt.ts';
import { DbTables } from '../../entities/db-tables.ts';
import type { GameRunId } from '../../entities/game-run.ts';

interface AdAttemptRow {
  game_run_id: number;
  ad_id: string;
  probability: string;
  dragon_level: number;
  turn: number;
  reward: number;
  success: boolean;
  estimated_probability: number;
  expected_value: number;
  rule: DecisionRule | null;
  created_at: Date;
}

interface CalibrationCountRow {
  probability: string;
  dragon_level: number;
  reward: number;
  attempts: number | string;
  successes: number | string | null;
}

const transform = ({ attempt }: { attempt: AdAttempt }): AdAttemptRow => ({
  game_run_id: attempt.gameRunId,
  ad_id: attempt.adId,
  probability: attempt.probability,
  dragon_level: attempt.dragonLevel,
  turn: attempt.turn,
  reward: attempt.reward,
  success: attempt.success,
  estimated_probability: attempt.estimatedProbability,
  expected_value: attempt.expectedValue,
  rule: attempt.rule,
  created_at: attempt.createdAt,
});

// A label this build does not know would poison calibration, so it fails here.
const reverseTransformCount = ({ row }: { row: CalibrationCountRow }): CalibrationCount => ({
  probability: ProbabilityLabelSchema.parse(row.probability),
  dragonLevel: row.dragon_level,
  reward: row.reward,
  attempts: Number(row.attempts),
  successes: Number(row.successes ?? 0),
});

const reverseTransform = ({ row }: { row: AdAttemptRow }): AdAttempt => ({
  gameRunId: row.game_run_id,
  adId: row.ad_id,
  probability: ProbabilityLabelSchema.parse(row.probability),
  dragonLevel: row.dragon_level,
  turn: row.turn,
  reward: row.reward,
  success: Boolean(row.success),
  estimatedProbability: row.estimated_probability,
  expectedValue: row.expected_value,
  rule: DecisionRuleSchema.nullable().parse(row.rule),
  createdAt: row.created_at,
});

const createOne = async ({ db, attempt }: { db: DbExecutor; attempt: AdAttempt }) => {
  await db(DbTables.AdAttempts).insert(transform({ attempt }));
};

const findMany = async ({
  db,
  gameRunId,
}: {
  db: DbExecutor;
  gameRunId: GameRunId;
}): Promise<AdAttempt[]> => {
  const rows = await db<AdAttemptRow>(DbTables.AdAttempts)
    .where({ game_run_id: gameRunId })
    .orderBy('id');

  return rows.map((row) => reverseTransform({ row }));
};

// A benchmark id scopes the evidence to that benchmark's games: a cold start that
// leaves every other game's history in place.
const findCalibrationCounts = async ({
  db,
  benchmarkId = null,
}: {
  db: DbExecutor;
  benchmarkId?: string | null;
}): Promise<CalibrationCount[]> => {
  const rows: CalibrationCountRow[] = await db(DbTables.AdAttempts)
    .select('probability', 'dragon_level', 'reward')
    .count({ attempts: '*' })
    .sum({ successes: 'success' })
    .groupBy('probability', 'dragon_level', 'reward')
    .modify((query) => {
      if (benchmarkId) {
        void query.whereIn(
          'game_run_id',
          db(DbTables.GameRuns).select('id').where({ benchmark_id: benchmarkId }),
        );
      }
    });

  return rows.map((row) => reverseTransformCount({ row }));
};

export const dbRepository = { createOne, findMany, findCalibrationCounts };
