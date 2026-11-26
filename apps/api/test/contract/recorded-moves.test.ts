import { beforeAll, describe, expect, it } from 'vitest';

import { AdExpiredError, GameNotFoundError } from '../../src/errors/errors.ts';
import * as mugloarRepository from '../../src/repositories/mugloar-repository.ts';
import {
  findRecording,
  gameIdOf,
  readRecordedGame,
  replayThrough,
  segmentsOf,
  startReplay,
} from '../support/recorded-game.ts';
import type { StoredRecording } from '../support/replay-fetch.ts';

type RecordedSolve = { highScore: number; lives: number } & Record<string, unknown>;

describe('Mugloar API against the recorded moves', () => {
  let recordings: StoredRecording[];

  const find = (predicate: (recording: StoredRecording) => boolean) =>
    findRecording({ recordings, predicate });

  beforeAll(async () => {
    recordings = await readRecordedGame();
  });

  it('reads the recorded game start', async () => {
    const recording = find(({ path }) => path.endsWith('/game/start'));

    await expect(
      replayThrough({ recording, call: () => mugloarRepository.startGame() }),
    ).resolves.toEqual(recording.body);
  });

  // Each ad is solved once, so one replay serves them all in a single pass.
  it('maps every recorded solve, the game-ending one included, dropping the high score', async () => {
    const solves = recordings.filter(
      ({ path, status }) => path.includes('/solve/') && status === 200,
    );

    expect(solves.map(({ body }) => (body as RecordedSolve).lives)).toContain(0);
    startReplay();

    for (const recording of solves) {
      const [gameId = '', , adId = ''] = segmentsOf(recording);
      const { highScore, ...outcome } = recording.body as RecordedSolve;

      expect(highScore).toEqual(expect.any(Number));
      await expect(mugloarRepository.solveAd({ gameId, adId })).resolves.toEqual({
        status: 'ok',
        value: outcome,
      });
    }
  });

  it('handles the recorded HTML 404 body', async () => {
    const recording = find(({ status }) => status === 404);

    expect(recording.body).toContain('<html');
    await expect(
      replayThrough({
        recording,
        call: () => mugloarRepository.findAds({ gameId: gameIdOf(recording) }),
      }),
    ).rejects.toBeInstanceOf(GameNotFoundError);
  });

  it('handles the recorded HTML 400 body on a solve as an expired ad', async () => {
    const recording = find(({ status, path }) => status === 400 && path.includes('/solve/'));
    const [gameId = '', , adId = ''] = segmentsOf(recording);

    expect(recording.body).toContain('<html');
    await expect(
      replayThrough({
        recording,
        call: () => mugloarRepository.solveAd({ gameId, adId }),
      }),
    ).rejects.toBeInstanceOf(AdExpiredError);
  });

  it('reads a recorded failed purchase (shoppingSuccess false) as success false', async () => {
    const recording = find(
      ({ path, body }) =>
        path.includes('/shop/buy/') &&
        (body as { shoppingSuccess?: unknown }).shoppingSuccess === false,
    );
    const [gameId = '', , , itemId = ''] = segmentsOf(recording);
    const result = await replayThrough({
      recording,
      call: () => mugloarRepository.buyItem({ gameId, itemId }),
    });

    expect(result.status === 'ok' && result.value.success).toBe(false);
  });
});
