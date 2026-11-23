import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import type { MugloarClient } from '../../src/adapters/mugloar-api-adapter/index.ts';
import { createMugloarClient } from '../../src/adapters/mugloar-api-adapter/index.ts';
import type { StoredRecording } from '../../src/adapters/mugloar-api-adapter/recorder.ts';
import {
  createReplayFetch,
  readRecordings,
} from '../../src/adapters/mugloar-api-adapter/recorder.ts';
import { AdExpiredError, GameNotFoundError } from '../../src/errors/errors.ts';
import { NO_THROTTLE, testConfig } from '../support/mugloar-client.ts';

const FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url));
// Recorded paths carry the live base path, so replay must be mounted under it.
const REPLAY_BASE_URL = 'https://replay.invalid/api/v2';
const ROT13 = 2;

const replayClient = (): MugloarClient =>
  createMugloarClient({
    config: testConfig({ baseUrl: REPLAY_BASE_URL }),
    fetchImpl: createReplayFetch({ directory: FIXTURES }),
    throttle: NO_THROTTLE,
  });

const segments = ({ path }: StoredRecording) => path.split('/').slice(3);

const gameIdOf = (recording: StoredRecording) => segments(recording)[0] ?? '';

// Replay serves a path's recordings in order, so reaching recording n of a
// path means making the n calls before it first.
const replayThrough = async <T>({
  recording,
  call,
}: {
  recording: StoredRecording;
  call: (client: MugloarClient) => Promise<T>;
}): Promise<T> => {
  const client = replayClient();

  for (let earlier = 0; earlier < recording.sequence; earlier += 1) {
    await call(client).catch(() => undefined);
  }

  return call(client);
};

describe('Mugloar client against recorded live responses', () => {
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
        call: (client) => client.fetchAds({ gameId: gameIdOf(recording) }),
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
      call: (client) => client.fetchAds({ gameId: gameIdOf(recording) }),
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
        call: (client) => client.fetchAds({ gameId: gameIdOf(recording) }),
      }),
    ).rejects.toBeInstanceOf(GameNotFoundError);
  });

  it('handles the recorded HTML 400 body', async () => {
    const recording = find(({ status, path }) => status === 400 && path.includes('/solve/'));
    const [gameId = '', , adId = ''] = segments(recording);

    expect(recording.body).toContain('<html');
    await expect(
      replayThrough({ recording, call: (client) => client.solveAd({ gameId, adId }) }),
    ).rejects.toBeInstanceOf(AdExpiredError);
  });

  it('reads the recorded 410 as game_over', async () => {
    const recording = find((candidate) => isBoard(candidate) && candidate.status === 410);

    await expect(
      replayThrough({
        recording,
        call: (client) => client.fetchAds({ gameId: gameIdOf(recording) }),
      }),
    ).resolves.toEqual({ status: 'game_over' });
  });

  it('reads a recorded failed purchase as shoppingSuccess false', async () => {
    const recording = find(
      ({ path, body }) =>
        path.includes('/shop/buy/') &&
        (body as { shoppingSuccess?: unknown }).shoppingSuccess === false,
    );
    const [gameId = '', , , itemId = ''] = segments(recording);
    const result = await replayThrough({
      recording,
      call: (client) => client.buyItem({ gameId, itemId }),
    });

    expect(result.status === 'ok' && result.value.shoppingSuccess).toBe(false);
  });
});
