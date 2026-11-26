import { PROBABILITY_LABELS, SolveParamsSchema } from '@bigbank-dragon/contracts';
import type { Ad } from '@bigbank-dragon/contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import type { OrGameOver } from '../../src/entities/or-game-over.ts';
import { adRepository } from '../../src/repositories/index.ts';
import { gameIdOf, readRecordedGame, startReplay } from '../support/recorded-game.ts';
import type { StoredRecording } from '../support/replay-fetch.ts';

const BASE64 = 1;
const ROT13 = 2;
const PLAIN_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ROT13_ALPHABET = 'nopqrstuvwxyzabcdefghijklmNOPQRSTUVWXYZABCDEFGHIJKLM';

type RawAd = { adId: string; message: string; probability: string; encrypted: number | null };
type BoardRead = { recording: StoredRecording; raws: RawAd[]; result: OrGameOver<Ad[]> };
type DecodedPair = { gameId: string; raw: RawAd; decoded: Ad | undefined };

const isLiveBoard = ({ method, path, status }: StoredRecording) =>
  method === 'GET' && path.endsWith('/messages') && status !== 404;

// Spelled out as a lookup table, independent of the shift arithmetic under test.
const rot13Of = (value: string) =>
  [...value].map((char) => ROT13_ALPHABET[PLAIN_ALPHABET.indexOf(char)] ?? char).join('');

const adsOf = ({ result }: BoardRead) => (result.status === 'ok' ? result.value : []);

// Ads keep their board order through decoding, so a raw ad pairs with the ad at its index.
const pairsEncryptedWith = ({ reads, scheme }: { reads: BoardRead[]; scheme: number }) =>
  reads.flatMap((read): DecodedPair[] =>
    read.raws.flatMap((raw, index) =>
      raw.encrypted === scheme
        ? [{ gameId: gameIdOf(read.recording), raw, decoded: adsOf(read)[index] }]
        : [],
    ),
  );

describe('Mugloar API against the recorded ad boards', () => {
  let reads: BoardRead[];

  // One pass in recorded order: replaying each board from scratch would re-read every
  // board before it, which is quadratic in the length of the game.
  beforeAll(async () => {
    const boards = (await readRecordedGame()).filter(isLiveBoard);

    startReplay();
    reads = [];

    for (const recording of boards) {
      reads.push({
        recording,
        raws: Array.isArray(recording.body) ? (recording.body as RawAd[]) : [],
        result: await adRepository.mugloar.findMany({ gameId: gameIdOf(recording) }),
      });
    }
  });

  it('parses every recorded board without dropping an ad', () => {
    const playable = reads.filter(({ recording }) => recording.status === 200);

    expect(playable.length).toBeGreaterThan(0);

    for (const read of playable) {
      expect(read.result.status).toBe('ok');
      expect(adsOf(read)).toHaveLength(read.raws.length);
    }
  });

  // None of the recorded solves used an encrypted ad, so the boards are the evidence.
  it('decodes every base64 (encrypted: 1) adId into one the solve route accepts', () => {
    const pairs = pairsEncryptedWith({ reads, scheme: BASE64 });

    expect(pairs.length).toBeGreaterThan(0);

    for (const { gameId, raw, decoded } of pairs) {
      expect(decoded).toMatchObject({
        adId: Buffer.from(raw.adId, 'base64').toString('utf8'),
        wasEncrypted: true,
      });
      expect(SolveParamsSchema.safeParse({ gameId, adId: decoded?.adId }).success).toBe(true);
      expect(SolveParamsSchema.safeParse({ gameId, adId: raw.adId }).success).toBe(false);
    }
  });

  it('decodes the recorded ROT13 (encrypted: 2) ads to a known label', () => {
    const pairs = pairsEncryptedWith({ reads, scheme: ROT13 });

    expect(pairs.length).toBeGreaterThan(0);

    for (const { raw, decoded } of pairs) {
      expect(decoded).toMatchObject({
        adId: rot13Of(raw.adId),
        message: rot13Of(raw.message),
        wasEncrypted: true,
      });
      expect(PROBABILITY_LABELS).toContain(decoded?.probability);
    }
  });

  it('reads the recorded 410 that ends the game as game_over', () => {
    const last = reads.at(-1);

    expect(last?.recording.status).toBe(410);
    expect(last?.result).toEqual({ status: 'game_over' });
  });
});
