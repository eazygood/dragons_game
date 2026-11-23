import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AdExpiredError, GameNotFoundError } from '../../src/errors/errors.ts';
import {
  adAttemptRepository,
  adRepository,
  purchaseRepository,
} from '../../src/repositories/index.ts';
import { pointAdapterAt } from '../support/mugloar-api.ts';
import type { StoredRecording } from '../support/replay-fetch.ts';
import { createReplayFetch, readRecordings } from '../support/replay-fetch.ts';

const FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url));
// Recorded paths carry the live base path, so replay must be mounted under it.
const REPLAY_BASE_URL = 'https://replay.invalid/api/v2';
const ROT13 = 2;

// Replay counts what it has served, so every replay needs a fresh fetch.
const startReplay = () => {
  pointAdapterAt({ baseUrl: REPLAY_BASE_URL });
  vi.stubGlobal('fetch', createReplayFetch({ directory: FIXTURES }));
};

const segments = ({ path }: StoredRecording) => path.split('/').slice(3);

const gameIdOf = (recording: StoredRecording) => segments(recording)[0] ?? '';

// Replay serves a path's recordings in order, so reaching recording n of a
// path means making the n calls before it first.
const replayThrough = async <T>({
  recording,
  call,
}: {
  recording: StoredRecording;
  call: () => Promise<T>;
}): Promise<T> => {
  startReplay();

  for (let earlier = 0; earlier < recording.sequence; earlier += 1) {
    await call().catch(() => undefined);
  }

  return call();
};

describe('Mugloar API against recorded live responses', () => {
  let recordings: StoredRecording[];

  const find = (predicate: (recording: StoredRecording) => boolean) => {
    const recording = recordings.find(predicate);

    if (!recording) {
      throw new Error('fixture missing: re-run pnpm capture');
    }

    return recording;
  };

  const isBoard = ({ method, path }: StoredRecording) =>
    method === 'GET' && path.endsWith('/messages');

  beforeAll(async () => {
    recordings = await readRecordings({ directory: FIXTURES });
  });

  it('parses every recorded ad board', async () => {
    const boards = recordings.filter((recording) => isBoard(recording) && recording.status === 200);

    expect(boards.length).toBeGreaterThan(0);

    for (const recording of boards) {
      const result = await replayThrough({
        recording,
        call: () => adRepository.mugloar.findMany({ gameId: gameIdOf(recording) }),
      });

      expect(result.status).toBe('ok');
    }
  });

  it('decodes the recorded encrypted: 2 board', async () => {
    const recording = find(
      (candidate) =>
        isBoard(candidate) &&
        Array.isArray(candidate.body) &&
        (candidate.body as { encrypted: unknown }[]).some(({ encrypted }) => encrypted === ROT13),
    );
    const result = await replayThrough({
      recording,
      call: () => adRepository.mugloar.findMany({ gameId: gameIdOf(recording) }),
    });

    expect(result.status === 'ok' && result.value.some(({ wasEncrypted }) => wasEncrypted)).toBe(
      true,
    );
  });

  it('handles the recorded HTML 404 body', async () => {
    const recording = find(({ status }) => status === 404);

    expect(recording.body).toContain('<html');
    await expect(
      replayThrough({
        recording,
        call: () => adRepository.mugloar.findMany({ gameId: gameIdOf(recording) }),
      }),
    ).rejects.toBeInstanceOf(GameNotFoundError);
  });

  it('handles the recorded HTML 400 body', async () => {
    const recording = find(({ status, path }) => status === 400 && path.includes('/solve/'));
    const [gameId = '', , adId = ''] = segments(recording);

    expect(recording.body).toContain('<html');
    await expect(
      replayThrough({
        recording,
        call: () => adAttemptRepository.mugloar.createOne({ gameId, adId }),
      }),
    ).rejects.toBeInstanceOf(AdExpiredError);
  });

  it('reads the recorded 410 as game_over', async () => {
    const recording = find((candidate) => isBoard(candidate) && candidate.status === 410);

    await expect(
      replayThrough({
        recording,
        call: () => adRepository.mugloar.findMany({ gameId: gameIdOf(recording) }),
      }),
    ).resolves.toEqual({ status: 'game_over' });
  });

  it('reads a recorded failed purchase (shoppingSuccess false) as success false', async () => {
    const recording = find(
      ({ path, body }) =>
        path.includes('/shop/buy/') &&
        (body as { shoppingSuccess?: unknown }).shoppingSuccess === false,
    );
    const [gameId = '', , , itemId = ''] = segments(recording);
    const result = await replayThrough({
      recording,
      call: () => purchaseRepository.mugloar.createOne({ gameId, itemId }),
    });

    expect(result.status === 'ok' && result.value.success).toBe(false);
  });
});
