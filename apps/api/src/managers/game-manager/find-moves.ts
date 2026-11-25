import type { Move } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { AdAttempt } from '../../entities/ad-attempt.ts';
import type { Purchase } from '../../entities/purchase.ts';
import { adAttemptRepository, purchaseRepository } from '../../repositories/index.ts';
import { findRun } from './find-run.ts';

const toSolveMove = ({ attempt }: { attempt: AdAttempt }): Move => ({
  kind: 'solve',
  turn: attempt.turn,
  success: attempt.success,
  probability: attempt.probability,
  reward: attempt.reward,
  estimatedProbability: attempt.estimatedProbability,
  expectedValue: attempt.expectedValue,
  rule: attempt.rule,
});

const toBuyMove = ({ purchase }: { purchase: Purchase }): Move => ({
  kind: 'buy',
  turn: purchase.turn,
  success: purchase.success,
  itemName: purchase.itemName,
  cost: purchase.cost,
  rule: purchase.rule,
});

// Reads the database only, so a bot's game can be watched without touching the upstream.
export const findMoves = async ({ db, gameId }: { db: Knex; gameId: string }): Promise<Move[]> => {
  const run = await findRun({ db, gameId });
  const [attempts, purchases] = await Promise.all([
    adAttemptRepository.db.findMany({ db, gameRunId: run.id }),
    purchaseRepository.db.findMany({ db, gameRunId: run.id }),
  ]);

  return [
    ...attempts.map((attempt) => toSolveMove({ attempt })),
    ...purchases.map((purchase) => toBuyMove({ purchase })),
  ].sort((first, second) => second.turn - first.turn);
};
