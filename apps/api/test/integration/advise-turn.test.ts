import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GameRun } from '../../src/entities/game-run.ts';
import { adviseTurn } from '../../src/managers/advisor-manager.ts';
import { startGameRun } from '../../src/managers/game-manager/index.ts';
import * as gameRepository from '../../src/repositories/game-repository/index.ts';
import { useMigratedDatabase } from '../support/integration-db.ts';
import { PLAYER_GAME_ID, SILENT_LOGGER, stubPlayerUpstream } from '../support/player-game.ts';
import { seedEvidence } from '../support/seed-evidence.ts';

const SURE_AD_ID = 'sure1';
const ADVERSE_HISTORY = [
  { label: 'Sure thing', level: 0, reward: 30, attempts: 100, successes: 0 },
] as const;
const PRIOR_ESTIMATE = 0.95;

describe('turn advice', () => {
  const db = useMigratedDatabase();
  let run: GameRun;

  const adviceFor = async ({ adId }: { adId: string }) => {
    const turn = await adviseTurn({ db, gameId: PLAYER_GAME_ID, logger: SILENT_LOGGER });

    if (turn.status === 'game_over') {
      throw new Error('the stubbed game is not over');
    }

    return turn.value.board.find((ad) => ad.adId === adId)?.advice;
  };

  beforeEach(async () => {
    stubPlayerUpstream();
    ({ run } = await startGameRun({ db, strategy: 'manual' }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('grades the board on the prior while there is no history', async () => {
    expect((await adviceFor({ adId: SURE_AD_ID }))?.estimatedProbability).toBe(PRIOR_ESTIMATE);
  });

  it('grades the board on every game the table holds, not only this one', async () => {
    await seedEvidence({ db, cells: [...ADVERSE_HISTORY] });

    expect((await adviceFor({ adId: SURE_AD_ID }))?.estimatedProbability).toBeLessThan(
      PRIOR_ESTIMATE,
    );
  });

  it('settles the run when the board comes back game over', async () => {
    vi.mocked(gameRepository.mugloar.findAds).mockResolvedValue({ status: 'game_over' });

    expect(await adviseTurn({ db, gameId: PLAYER_GAME_ID, logger: SILENT_LOGGER })).toEqual({
      status: 'game_over',
    });
    expect(await gameRepository.db.findOne({ db, gameId: run.gameId })).toMatchObject({
      status: 'game_over',
    });
  });
});
