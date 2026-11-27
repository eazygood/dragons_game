import type { Move } from '@dragons-game/contracts';
import type { Knex } from 'knex';

import type { AdAttempt } from '../../entities/ad-attempt.ts';
import type { Purchase } from '../../entities/purchase.ts';
import * as adAttemptManager from '../ad-attempt-manager.ts';
import * as purchaseManager from '../purchase-manager.ts';
import { findRun } from './game-runs.ts';

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
export const findMoveHistory = async ({
  db,
  gameId,
}: {
  db: Knex;
  gameId: string;
}): Promise<Move[]> => {
  const run = await findRun({ db, gameId });
  const [attempts, purchases] = await Promise.all([
    adAttemptManager.findMany({ db, gameRunId: run.id }),
    purchaseManager.findMany({ db, gameRunId: run.id }),
  ]);

  return [
    ...attempts.map((attempt) => toSolveMove({ attempt })),
    ...purchases.map((purchase) => toBuyMove({ purchase })),
  ].sort((first, second) => second.turn - first.turn);
};
