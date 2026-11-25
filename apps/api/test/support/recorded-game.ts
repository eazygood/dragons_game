import { fileURLToPath } from 'node:url';

import { vi } from 'vitest';

import { pointAdapterAt } from './mugloar-api.ts';
import { createReplayFetch, readRecordings } from './replay-fetch.ts';
import type { StoredRecording } from './replay-fetch.ts';

const FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url));
// Recorded paths carry the live base path, so replay must be mounted under it.
const REPLAY_BASE_URL = 'https://replay.invalid/api/v2';

export const readRecordedGame = () => readRecordings({ directory: FIXTURES });

// Replay counts what it has served, so every replay needs a fresh fetch.
export const startReplay = () => {
  pointAdapterAt({ baseUrl: REPLAY_BASE_URL });
  vi.stubGlobal('fetch', createReplayFetch({ directory: FIXTURES }));
};

// The path segments after /api/v2: [gameId, 'solve', adId], [gameId, 'shop', 'buy', itemId]…
export const segmentsOf = ({ path }: StoredRecording) => path.split('/').slice(3);

export const gameIdOf = (recording: StoredRecording) => segmentsOf(recording)[0] ?? '';

export const findRecording = ({
  recordings,
  predicate,
}: {
  recordings: StoredRecording[];
  predicate: (recording: StoredRecording) => boolean;
}) => {
  const recording = recordings.find(predicate);

  if (!recording) {
    throw new Error('fixture missing: re-record it (see docs/agent_docs/testing.md)');
  }

  return recording;
};

// Replay serves a path's recordings in order, so reaching recording n of a
// path means making the n calls before it first.
export const replayThrough = async <T>({
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
