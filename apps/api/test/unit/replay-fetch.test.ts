import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Recording } from '../support/replay-fetch.ts';
import { createReplayFetch, readRecordings, recordingFileOf } from '../support/replay-fetch.ts';

const HTML_404 = '<html><body><h1>404 Not Found</h1></body></html>';
const BOARD = [{ adId: 'a1', reward: 5 }];

const NOT_FOUND: Recording = {
  method: 'GET',
  path: '/api/v2/bad/messages',
  status: 404,
  contentType: 'text/html',
  body: HTML_404,
};

const SOLVE: Recording = {
  method: 'POST',
  path: '/api/v2/g1/solve/a1',
  status: 200,
  contentType: 'application/json',
  body: BOARD,
};

describe('replay fetch', () => {
  let directory: string;

  const store = ({ recording, sequence }: { recording: Recording; sequence: number }) =>
    writeFile(
      join(directory, recordingFileOf({ ...recording, sequence })),
      JSON.stringify(recording),
    );

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'replay-'));
    await store({ recording: NOT_FOUND, sequence: 0 });
    await store({ recording: SOLVE, sequence: 0 });
    await store({ recording: SOLVE, sequence: 1 });
  });

  afterAll(() => rm(directory, { recursive: true, force: true }));

  it('replays a recorded response byte for byte, whatever the host', async () => {
    const replay = createReplayFetch({ directory });
    const response = await replay('https://other/api/v2/bad/messages');

    expect(response.status).toBe(404);
    expect(await response.text()).toBe(HTML_404);
  });

  it('replays repeated requests in recorded order, then refuses', async () => {
    const replay = createReplayFetch({ directory });
    const solve = () => replay('https://other/api/v2/g1/solve/a1', { method: 'POST' });

    expect(await (await solve()).json()).toEqual(BOARD);
    expect(await (await solve()).json()).toEqual(BOARD);
    await expect(solve()).rejects.toThrow(/no recording/i);
  });

  it('lists recordings in request order with their sequence number', async () => {
    const recordings = await readRecordings({ directory });
    const solves = recordings.filter(({ path }) => path.endsWith('/solve/a1'));

    expect(solves.map(({ sequence }) => sequence)).toEqual([0, 1]);
  });
});
