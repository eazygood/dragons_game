import type { Ad, GameState, Reasoning, ShopItem } from '@bigbank-dragon/contracts';
import { afterEach, beforeEach, vi } from 'vitest';

import type { GameRun } from '../../src/entities/game-run.ts';
import { SILENT_LOGGER } from '../../src/managers/bot-manager/index.ts';
import { playBuyTurn, playSolveTurn, startGameRun } from '../../src/managers/game-manager/index.ts';
import type { MoveContext } from '../../src/managers/game-manager/index.ts';
import type { OnPersistFailure } from '../../src/managers/game-manager/save-state-with-record.ts';
import {
  adAttemptRepository,
  gameRunRepository,
  purchaseRepository,
} from '../../src/repositories/index.ts';
import { useMigratedDatabase } from './integration-db.ts';

export const CLAW_HONING: ShopItem = { id: 'ch', name: 'Claw Honing', cost: 300 };

export const AD: Ad = {
  adId: 'a1',
  message: 'Help someone',
  reward: 20,
  expiresIn: 5,
  probability: 'Quite likely',
  wasEncrypted: false,
};

const REASONING = {
  rule: 'best_expected_value',
  estimatedProbability: 0.8,
  expectedValue: 12.5,
  consideredCount: 4,
} as const;

// The player's shop is the only way to buy a level, so the record carries that rule.
const PURCHASE_REASONING: Reasoning = {
  rule: 'level_up',
  estimatedProbability: null,
  expectedValue: null,
  consideredCount: 11,
};

export const LEVEL_AFTER_PURCHASE = 2;
export const TURN_AFTER_PURCHASE = 5;

// A started run with the upstream stubbed to accept every move, for the manager's persistence tests.
export const useManagedGame = () => {
  const db = useMigratedDatabase();
  let run: GameRun;
  let state: GameState;

  const contextFor = ({
    onPersistFailure,
  }: {
    onPersistFailure: OnPersistFailure;
  }): MoveContext => ({
    db,
    run,
    state,
    logger: SILENT_LOGGER,
    onPersistFailure,
  });

  beforeEach(async () => {
    vi.spyOn(gameRunRepository.mugloar, 'createOne').mockResolvedValue({
      gameId: 'mgr-game',
      lives: 3,
      gold: 0,
      level: 0,
      score: 0,
      highScore: 0,
      turn: 0,
    });
    vi.spyOn(adAttemptRepository.mugloar, 'createOne').mockResolvedValue({
      status: 'ok',
      value: { success: true, lives: 3, gold: 20, score: 20, turn: 1, message: 'ok' },
    });
    vi.spyOn(purchaseRepository.mugloar, 'createOne').mockResolvedValue({
      status: 'ok',
      value: {
        success: true,
        gold: 0,
        lives: 3,
        level: LEVEL_AFTER_PURCHASE,
        turn: TURN_AFTER_PURCHASE,
      },
    });

    ({ run, state } = await startGameRun({ db, strategy: 'calibrated' }));
    state = { ...state, gold: 300, turn: 4 };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  return {
    db,
    current: () => ({ run, state }),
    solveTheAd: () =>
      playSolveTurn({
        context: contextFor({ onPersistFailure: 'keep_playing' }),
        ad: AD,
        reasoning: REASONING,
      }),
    buyClawHoning: ({ onPersistFailure }: { onPersistFailure: OnPersistFailure }) =>
      playBuyTurn({
        context: contextFor({ onPersistFailure }),
        item: CLAW_HONING,
        reasoning: PURCHASE_REASONING,
      }),
    storedRun: () => gameRunRepository.db.findOne({ db, gameId: run.gameId }),
    countOf: async ({ table }: { table: string }) => db(table).count({ count: '*' }),
  };
};
