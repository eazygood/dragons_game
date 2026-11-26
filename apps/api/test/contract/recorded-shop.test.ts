import { RECORDED_SHOP_ITEMS } from '@bigbank-dragon/contracts/test-support';
import { beforeAll, describe, expect, it } from 'vitest';

import { shopItemRepository } from '../../src/repositories/index.ts';
import {
  findRecording,
  gameIdOf,
  readRecordedGame,
  replayThrough,
} from '../support/recorded-game.ts';
import type { StoredRecording } from '../support/replay-fetch.ts';

const isShopRead = ({ method, path }: StoredRecording) =>
  method === 'GET' && path.endsWith('/shop');

describe('Mugloar API against the recorded shop', () => {
  let recording: StoredRecording;

  beforeAll(async () => {
    recording = findRecording({ recordings: await readRecordedGame(), predicate: isShopRead });
  });

  // /shop is a bare array like /messages, unlike what the published docs show.
  it('reads the recorded bare array into the shop items, field for field', async () => {
    const result = await replayThrough({
      recording,
      call: () => shopItemRepository.mugloar.findMany({ gameId: gameIdOf(recording) }),
    });

    expect(Array.isArray(recording.body)).toBe(true);
    expect(result).toEqual({ status: 'ok', value: recording.body });
  });

  it('matches the shop the strategy tests are written against', () => {
    expect(recording.body).toEqual(RECORDED_SHOP_ITEMS);
  });
});
