import type { Knex } from 'knex';

// Literals, not imported constants: a migration is a frozen record of the
// schema at one point in time and must not change when the code does.
const STRATEGIES = ['manual', 'baseline', 'calibrated'];
const RUN_STATUSES = ['active', 'game_over', 'abandoned'];
const ID_LENGTH = 64;
const LABEL_LENGTH = 32;
const PROBABILITY_PRECISION = [5, 4] as const;
const VALUE_PRECISION = [12, 4] as const;

const gameRunReference = (table: Knex.CreateTableBuilder) =>
  table
    .bigInteger('game_run_id')
    .unsigned()
    .notNullable()
    .references('id')
    .inTable('game_runs')
    .onDelete('CASCADE');

export const up = async (knex: Knex): Promise<void> => {
  await knex.schema.createTable('game_runs', (table) => {
    table.bigIncrements('id');
    table.string('game_id', ID_LENGTH).notNullable().index();
    table.enum('strategy', STRATEGIES).notNullable();
    table.string('benchmark_id', ID_LENGTH).nullable().index();
    table.integer('lives').notNullable();
    table.integer('gold').notNullable();
    table.integer('dragon_level').notNullable();
    table.integer('turn').notNullable();
    table.integer('score').notNullable();
    table.enum('status', RUN_STATUSES).notNullable().defaultTo('active');
    table.dateTime('started_at').notNullable();
    table.dateTime('ended_at').nullable();
  });

  await knex.schema.createTable('ad_attempts', (table) => {
    table.bigIncrements('id');
    gameRunReference(table);
    table.string('ad_id', ID_LENGTH).notNullable();
    table.string('probability', LABEL_LENGTH).notNullable();
    table.integer('dragon_level').notNullable();
    table.integer('turn').notNullable();
    table.integer('reward').notNullable();
    table.boolean('success').notNullable();
    table.decimal('estimated_probability', ...PROBABILITY_PRECISION).notNullable();
    table.decimal('expected_value', ...VALUE_PRECISION).notNullable();
    table.dateTime('created_at').notNullable();
    table.index(['probability', 'dragon_level']);
  });

  await knex.schema.createTable('purchases', (table) => {
    table.bigIncrements('id');
    gameRunReference(table);
    table.string('item_id', ID_LENGTH).notNullable();
    table.integer('cost').notNullable();
    table.integer('turn').notNullable();
    table.boolean('success').notNullable();
    table.dateTime('created_at').notNullable();
  });
};

export const down = async (knex: Knex): Promise<void> => {
  await knex.schema.dropTableIfExists('purchases');
  await knex.schema.dropTableIfExists('ad_attempts');
  await knex.schema.dropTableIfExists('game_runs');
};
