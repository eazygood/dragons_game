import type { Knex } from 'knex';

// Phase 1 benchmark: encrypted and plaintext ads succeed at the same rate, so
// the column tested a hypothesis that did not hold.
export const up = async (knex: Knex): Promise<void> => {
  await knex.schema.alterTable('ad_attempts', (table) => {
    table.dropColumn('was_encrypted');
  });
};

export const down = async (knex: Knex): Promise<void> => {
  await knex.schema.alterTable('ad_attempts', (table) => {
    table.boolean('was_encrypted').notNullable().defaultTo(false).after('reward');
  });
};
