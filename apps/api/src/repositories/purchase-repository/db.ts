import { DecisionRuleSchema } from '@bigbank-dragon/contracts';
import type { DecisionRule } from '@bigbank-dragon/contracts';

import type { DbExecutor } from '../../adapters/mysql-adapter.ts';
import { DbTables } from '../../entities/db-tables.ts';
import type { GameRunId } from '../../entities/game-run.ts';
import type { Purchase } from '../../entities/purchase.ts';

export interface PurchaseRow {
  game_run_id: number;
  item_id: string;
  item_name: string | null;
  rule: DecisionRule | null;
  cost: number;
  turn: number;
  success: boolean;
  created_at: Date;
}

export const transform = ({ purchase }: { purchase: Purchase }): PurchaseRow => ({
  game_run_id: purchase.gameRunId,
  item_id: purchase.itemId,
  item_name: purchase.itemName,
  rule: purchase.rule,
  cost: purchase.cost,
  turn: purchase.turn,
  success: purchase.success,
  created_at: purchase.createdAt,
});

const reverseTransform = ({ row }: { row: PurchaseRow }): Purchase => ({
  gameRunId: row.game_run_id,
  itemId: row.item_id,
  itemName: row.item_name,
  rule: DecisionRuleSchema.nullable().parse(row.rule),
  cost: row.cost,
  turn: row.turn,
  success: Boolean(row.success),
  createdAt: row.created_at,
});

const createOne = async ({ db, purchase }: { db: DbExecutor; purchase: Purchase }) => {
  await db(DbTables.Purchases).insert(transform({ purchase }));
};

const findMany = async ({
  db,
  gameRunId,
}: {
  db: DbExecutor;
  gameRunId: GameRunId;
}): Promise<Purchase[]> => {
  const rows = await db<PurchaseRow>(DbTables.Purchases)
    .where({ game_run_id: gameRunId })
    .orderBy('id');

  return rows.map((row) => reverseTransform({ row }));
};

export const dbRepository = { createOne, findMany };
