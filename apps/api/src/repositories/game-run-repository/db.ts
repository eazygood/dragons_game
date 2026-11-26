import { StrategyNameSchema } from '@bigbank-dragon/contracts';
import { z } from 'zod';

import type { DbExecutor } from '../../adapters/mysql-adapter.ts';
import { RUN_STATUSES } from '../../entities/game-run.ts';
import type { GameRun, GameRunId, GameRunPatch, NewGameRun } from '../../entities/game-run.ts';
import { DbTables } from '../db-tables.ts';

interface GameRunRow {
  id: number;
  game_id: string;
  strategy: string;
  benchmark_id: string | null;
  lives: number;
  gold: number;
  dragon_level: number;
  turn: number;
  score: number;
  status: string;
  started_at: Date;
  ended_at: Date | null;
}

type NewGameRunRow = Omit<GameRunRow, 'id'>;

// Typed both ways, so renaming either a field or a column is a compile error.
const PATCH_COLUMNS = {
  lives: 'lives',
  gold: 'gold',
  dragonLevel: 'dragon_level',
  turn: 'turn',
  score: 'score',
  status: 'status',
  endedAt: 'ended_at',
} as const satisfies Record<keyof GameRunPatch, keyof NewGameRunRow>;

const RunStatusSchema = z.enum(RUN_STATUSES);

const transform = ({ gameRun }: { gameRun: NewGameRun }): NewGameRunRow => ({
  game_id: gameRun.gameId,
  strategy: gameRun.strategy,
  benchmark_id: gameRun.benchmarkId,
  lives: gameRun.lives,
  gold: gameRun.gold,
  dragon_level: gameRun.dragonLevel,
  turn: gameRun.turn,
  score: gameRun.score,
  status: gameRun.status,
  started_at: gameRun.startedAt,
  ended_at: gameRun.endedAt,
});

const reverseTransform = ({ row }: { row: GameRunRow }): GameRun => ({
  id: row.id,
  gameId: row.game_id,
  strategy: StrategyNameSchema.parse(row.strategy),
  benchmarkId: row.benchmark_id,
  lives: row.lives,
  gold: row.gold,
  dragonLevel: row.dragon_level,
  turn: row.turn,
  score: row.score,
  status: RunStatusSchema.parse(row.status),
  startedAt: row.started_at,
  endedAt: row.ended_at,
});

const transformPatch = ({ patch }: { patch: GameRunPatch }): Partial<NewGameRunRow> =>
  Object.fromEntries(
    Object.entries(patch).map(([field, value]) => [
      PATCH_COLUMNS[field as keyof GameRunPatch],
      value,
    ]),
  );

const createOne = async ({
  db,
  gameRun,
}: {
  db: DbExecutor;
  gameRun: NewGameRun;
}): Promise<GameRunId> => {
  const [id] = await db(DbTables.GameRuns).insert(transform({ gameRun }));

  return Number(id);
};

const findOne = async ({
  db,
  gameId,
}: {
  db: DbExecutor;
  gameId: string;
}): Promise<GameRun | null> => {
  const row = await db<GameRunRow>(DbTables.GameRuns).where({ game_id: gameId }).first();

  return row ? reverseTransform({ row }) : null;
};

const findMany = async ({
  db,
  benchmarkId,
}: {
  db: DbExecutor;
  benchmarkId: string;
}): Promise<GameRun[]> => {
  const rows = await db<GameRunRow>(DbTables.GameRuns)
    .where({ benchmark_id: benchmarkId })
    .orderBy('id');

  return rows.map((row) => reverseTransform({ row }));
};

const updateOne = async ({
  db,
  id,
  patch,
}: {
  db: DbExecutor;
  id: GameRunId;
  patch: GameRunPatch;
}): Promise<void> => {
  await db(DbTables.GameRuns).where({ id }).update(transformPatch({ patch }));
};

export const dbRepository = { createOne, findOne, findMany, updateOne };
