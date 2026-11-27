import { describe, expect, it } from 'vitest';

import { AdExpiredError, UpstreamUnavailableError } from '../../src/errors/errors.ts';
import { MAX_CONSECUTIVE_FAILED_TURNS, playGame } from '../../src/managers/bot-manager.ts';
import { startGameRun } from '../../src/managers/game-manager/index.ts';
import * as gameRunRepository from '../../src/repositories/game-run-repository.ts';
import {
  BOT_CONFIG,
  SCRIPTED_SCORE,
  SCRIPTED_TURNS,
  botLogger,
  useBotRunHarness,
} from '../support/bot-run.ts';

const TURNS_BEFORE_ABORT = 2;

const timedOut = () => new UpstreamUnavailableError({ message: 'solve timed out' });

describe('playGame resilience', () => {
  const harness = useBotRunHarness();
  const { db } = harness;

  const playScriptedGame = async ({ signal }: { signal?: AbortSignal } = {}) => {
    const { run, state } = await startGameRun({ db, strategy: 'calibrated' });
    const playing = playGame({
      db,
      run,
      state,
      strategy: 'calibrated',
      calibrationBenchmarkId: null,
      config: BOT_CONFIG,
      logger: botLogger,
      signal,
    });

    return { gameId: run.gameId, playing };
  };

  const statusOf = async ({ gameId }: { gameId: string }) =>
    (await gameRunRepository.findOne({ db, gameId }))?.status;

  // Wraps the scripted solve so chosen calls (1-based) fail and the rest play as scripted.
  const failSolveOnCalls = ({ calls, error }: { calls: number[]; error: () => Error }) => {
    const scriptedSolve = harness.scriptedGame.solveAd.getMockImplementation();
    let call = 0;

    harness.scriptedGame.solveAd.mockImplementation((input) => {
      call += 1;

      return calls.includes(call) || !scriptedSolve
        ? Promise.reject(error())
        : scriptedSolve(input);
    });
  };

  it('plays on after a single upstream timeout, re-reading the board', async () => {
    harness.scriptedGame.solveAd.mockRejectedValueOnce(timedOut());

    const { gameId, playing } = await playScriptedGame();

    await expect(playing).resolves.toMatchObject({ score: SCRIPTED_SCORE, turns: SCRIPTED_TURNS });
    expect(harness.scriptedGame.solveAd).toHaveBeenCalledTimes(SCRIPTED_TURNS + 1);
    expect(botLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ consecutiveFailedTurns: 1 }),
      'turn failed; playing on',
    );
    expect(await statusOf({ gameId })).toBe('game_over');
  });

  it('plays on after an ad expires under it', async () => {
    harness.scriptedGame.solveAd.mockRejectedValueOnce(new AdExpiredError({ message: 'expired' }));

    const { playing } = await playScriptedGame();

    await expect(playing).resolves.toMatchObject({ score: SCRIPTED_SCORE });
  });

  it('abandons the run after too many failed turns in a row, without retrying any', async () => {
    harness.scriptedGame.solveAd.mockRejectedValue(timedOut());

    const { gameId, playing } = await playScriptedGame();

    await expect(playing).rejects.toBeInstanceOf(UpstreamUnavailableError);
    expect(harness.scriptedGame.solveAd).toHaveBeenCalledTimes(MAX_CONSECUTIVE_FAILED_TURNS);
    expect(await statusOf({ gameId })).toBe('abandoned');
  });

  it('counts only consecutive failures, so a success in between resets the count', async () => {
    failSolveOnCalls({ calls: [1, 2, 4, 5], error: timedOut });

    const { playing } = await playScriptedGame();

    await expect(playing).resolves.toMatchObject({ score: SCRIPTED_SCORE });
  });

  it('stops before the next turn once the signal aborts, and abandons the run', async () => {
    const controller = new AbortController();
    const scriptedSolve = harness.scriptedGame.solveAd.getMockImplementation();

    harness.scriptedGame.solveAd.mockImplementation(async (input) => {
      const solved = await scriptedSolve?.(input);

      if (harness.scriptedGame.solveAd.mock.calls.length === TURNS_BEFORE_ABORT) {
        controller.abort();
      }

      return solved ?? { status: 'game_over' };
    });

    const { gameId, playing } = await playScriptedGame({ signal: controller.signal });

    await expect(playing).resolves.toMatchObject({ turns: TURNS_BEFORE_ABORT });
    expect(await statusOf({ gameId })).toBe('abandoned');
  });
});
