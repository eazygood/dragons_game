export const DbTables = {
  GameRuns: 'game_runs',
  AdAttempts: 'ad_attempts',
  Purchases: 'purchases',
} as const;

export type DbTable = (typeof DbTables)[keyof typeof DbTables];
