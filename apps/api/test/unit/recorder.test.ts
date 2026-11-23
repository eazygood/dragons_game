import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createRecordingFetch,
  createReplayFetch,
  readRecordings,
} from '../../src/adapters/mugloar-api-adapter/recorder.ts';

const HTML_404 = '<html><body><h1>404 Not Found</h1></body></html>';
const BOARD = [{ adId: 'a1', reward: 5 }];

const htmlErrorFetch: typeof fetch = () =>
  Promise.resolve(
    new Response(HTML_404, { status: 404, headers: { 'content-type': 'text/html' } }),
  );

const boardFetch: typeof fetch = () =>
  Promise.resolve(
    new Response(JSON.stringify(BOARD), {
      status: 200,
      headers: { 'content-type': 'application/json;charset=UTF-8' },
    }),
  );

const fileIn = async ({ directory, name }: { directory: string; name: string }) =>
  JSON.parse(await readFile(join(directory, name), 'utf8')) as Record<string, unknown>;

describe('recording fetch', () => {
  let directory: string;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'recorder-'));
  });

  afterAll(() => rm(directory, { recursive: true, force: true }));

  it('writes the response body verbatim, including an HTML error page', async () => {
    const recording = createRecordingFetch({ fetchImpl: htmlErrorFetch, directory });
    const response = await recording('https://host/api/v2/bad/messages');

    expect(await response.text()).toBe(HTML_404);

    const written = await fileIn({ directory, name: 'get-api-v2-bad-messages-0.json' });

    expect(written).toEqual({
      method: 'GET',
      path: '/api/v2/bad/messages',
      status: 404,
      contentType: 'text/html',
      body: HTML_404,
    });
  });

  it('stores a JSON body as JSON and numbers repeated requests', async () => {
    const recording = createRecordingFetch({ fetchImpl: boardFetch, directory });

    await recording('https://host/api/v2/g1/solve/a1', { method: 'POST' });
    await recording('https://host/api/v2/g1/solve/a1', { method: 'POST' });

    const second = await fileIn({ directory, name: 'post-api-v2-g1-solve-a1-1.json' });

    expect(second.body).toEqual(BOARD);
    expect(await readdir(directory)).toContain('post-api-v2-g1-solve-a1-0.json');
  });

  it('replays a recorded response byte for byte', async () => {
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
