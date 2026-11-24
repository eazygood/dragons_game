import type { Knex } from 'knex';

// Literals, not imported constants: a migration is a frozen record of the
// schema at one point in time and must not change when the code does.
const DECISION_RULES = [
  'survival_floor',
  'level_up',
  'best_expected_value',
  'safest_available',
  'no_viable_option',
  'player_choice',
];
const ITEM_NAME_LENGTH = 64;

// Nullable because rows written before this migration have no recorded rule.
export const up = async (knex: Knex): Promise<void> => {
  await knex.schema.alterTable('ad_attempts', (table) => {
    table.enum('rule', DECISION_RULES).nullable();
  });

  await knex.schema.alterTable('purchases', (table) => {
    table.enum('rule', DECISION_RULES).nullable();
    table.string('item_name', ITEM_NAME_LENGTH).nullable();
  });
};

export const down = async (knex: Knex): Promise<void> => {
  await knex.schema.alterTable('purchases', (table) => {
    table.dropColumn('item_name');
    table.dropColumn('rule');
  });

  await knex.schema.alterTable('ad_attempts', (table) => {
    table.dropColumn('rule');
  });
};
