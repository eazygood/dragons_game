import type { Knex } from 'knex';

// One upstream game is one run. The plain index let a duplicate in silently, and reads
// had to guess which row was current.
export const up = async (knex: Knex): Promise<void> => {
  await knex.schema.alterTable('game_runs', (table) => {
    table.dropIndex(['game_id']);
    table.unique(['game_id']);
  });
};

export const down = async (knex: Knex): Promise<void> => {
  await knex.schema.alterTable('game_runs', (table) => {
    table.dropUnique(['game_id']);
    table.index(['game_id']);
  });
};
