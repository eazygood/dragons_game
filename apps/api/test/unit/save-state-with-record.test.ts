import type { Knex } from 'knex';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GameRun } from '../../src/entities/game-run.ts';
import { PersistenceFailedError } from '../../src/errors/errors.ts';
import { saveStateWithRecord } from '../../src/managers/game-manager/index.ts';
import type { OnPersistFailure } from '../../src/managers/game-manager/index.ts';
import * as gameRunRepository from '../../src/repositories/game-run-repository.ts';

const STATE = { gameId: 'g1', lives: 3, gold: 30, dragonLevel: 1, turn: 4, score: 30 };
const TURN = { state: STATE, success: true, message: 'ok' };
const RUN = { id: 7, gameId: 'g1' } as GameRun;
const LOGGER = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const TRANSACTION = { isTransaction: true } as unknown as Knex.Transaction;

const transactionThatFails = () => vi.fn().mockRejectedValue(new Error('db down'));
const transactionThatRuns = () =>
  vi.fn((callback: (trx: Knex.Transaction) => Promise<unknown>) => callback(TRANSACTION));

const save = ({
  transaction,
  onPersistFailure,
  writeRecord = () => Promise.resolve(),
}: {
  transaction: ReturnType<typeof vi.fn>;
  onPersistFailure: OnPersistFailure;
  writeRecord?: (trx: Knex.Transaction) => Promise<unknown>;
}) =>
  saveStateWithRecord({
    db: { transaction } as unknown as Knex,
    run: RUN,
    turnResult: TURN,
    logger: LOGGER,
    writeRecord,
    onPersistFailure,
  });

afterEach(() => {
  vi.restoreAllMocks();
  LOGGER.warn.mockClear();
});

describe('saveStateWithRecord', () => {
  it('writes the state and the record on one transaction', async () => {
    const updateOne = vi.spyOn(gameRunRepository, 'updateOne').mockResolvedValue();
    const writeRecord = vi.fn().mockResolvedValue(undefined);

    const saved = await save({
      transaction: transactionThatRuns(),
      onPersistFailure: 'keep_playing',
      writeRecord,
    });

    expect(saved).toEqual({ turn: TURN, persisted: true });
    expect(updateOne).toHaveBeenCalledWith(expect.objectContaining({ db: TRANSACTION, id: 7 }));
    expect(writeRecord).toHaveBeenCalledWith(TRANSACTION);
  });

  it('keep_playing: reports the lost record and writes nothing more', async () => {
    const updateOne = vi.spyOn(gameRunRepository, 'updateOne').mockResolvedValue();

    const saved = await save({
      transaction: transactionThatFails(),
      onPersistFailure: 'keep_playing',
    });

    expect(saved).toEqual({ turn: TURN, persisted: false });
    expect(updateOne).not.toHaveBeenCalled();
    expect(LOGGER.warn).toHaveBeenCalledOnce();
  });

  it('save_state_only: saves the state outside the failed transaction', async () => {
    const updateOne = vi.spyOn(gameRunRepository, 'updateOne').mockResolvedValue();

    const saved = await save({
      transaction: transactionThatFails(),
      onPersistFailure: 'save_state_only',
    });

    expect(saved).toEqual({ turn: TURN, persisted: false });
    expect(updateOne).toHaveBeenCalledOnce();
    expect(updateOne.mock.calls[0]?.[0]).toMatchObject({ id: 7, patch: { dragonLevel: 1 } });
  });

  it('save_state_only: fails the move when not even the state can be saved', async () => {
    vi.spyOn(gameRunRepository, 'updateOne').mockRejectedValue(new Error('still down'));

    await expect(
      save({ transaction: transactionThatFails(), onPersistFailure: 'save_state_only' }),
    ).rejects.toBeInstanceOf(PersistenceFailedError);
  });
});
