import type { DbExecutor } from '../adapters/mysql-adapter.ts';
import { DbTables } from '../entities/db-tables.ts';
import type { Purchase } from '../entities/purchase.ts';

export interface PurchaseRow {
  game_run_id: number;
  item_id: string;
  cost: number;
  turn: number;
  success: boolean;
  created_at: Date;
}

export const transform = ({ purchase }: { purchase: Purchase }): PurchaseRow => ({
  game_run_id: purchase.gameRunId,
  item_id: purchase.itemId,
  cost: purchase.cost,
  turn: purchase.turn,
  success: purchase.success,
  created_at: purchase.createdAt,
});

const createOne = async ({ db, purchase }: { db: DbExecutor; purchase: Purchase }) => {
  await db(DbTables.Purchases).insert(transform({ purchase }));
};

export const purchaseRepository = { createOne };
