import { mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

import type { Ad } from '@bigbank-dragon/contracts';
import { HEALING_POTION_ID, IMPOSSIBLE_LABEL, PROBABILITY_PRIOR } from '@bigbank-dragon/contracts';

import { createMugloarClient } from '../adapters/mugloar-api-adapter/index.ts';
import type { MugloarClient } from '../adapters/mugloar-api-adapter/index.ts';
import { createRecordingFetch, readRecordings } from '../adapters/mugloar-api-adapter/recorder.ts';
import { createTokenBucket } from '../adapters/mugloar-api-adapter/throttle.ts';
import { loadConfig } from '../config/index.ts';
import { AdExpiredError, GameNotFoundError } from '../errors/errors.ts';

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const UNKNOWN_GAME_ID = 'capture-unknown-game';
// Survive this many turns on the safest ads to see many boards (encrypted ads
// are rare), then take the riskiest ones so the run reaches its 410.
const SAFE_TURNS = 40;
const MAX_TURNS = 200;

type Findings = Record<string, boolean>;

const priorOf = (ad: Ad) => PROBABILITY_PRIOR[ad.probability];

const pickAd = ({ ads, turn }: { ads: Ad[]; turn: number }): Ad | undefined => {
  const ranked = [...ads].sort((left, right) => priorOf(right) - priorOf(left));

  if (turn < SAFE_TURNS) {
    return ranked.find((ad) => ad.probability !== IMPOSSIBLE_LABEL);
  }

  return ranked.at(-1);
};

const rejectsWith = (promise: Promise<unknown>, type: new (...args: never[]) => Error) =>
  promise.then(
    () => false,
    (error: unknown) => error instanceof type,
  );

const playToGameOver = async ({ client, gameId }: { client: MugloarClient; gameId: string }) => {
  let staleProbed = false;
  let staleRejected = false;

  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    const board = await client.fetchAds({ gameId });

    if (board.status === 'game_over') {
      return { gameOver: true, staleRejected };
    }

    const ad = pickAd({ ads: board.value, turn });

    if (!ad) {
      continue;
    }

    const outcome = await client.solveAd({ gameId, adId: ad.adId });

    if (!staleProbed && outcome.status === 'ok') {
      staleProbed = true;
      staleRejected = await rejectsWith(client.solveAd({ gameId, adId: ad.adId }), AdExpiredError);
    }
  }

  return { gameOver: false, staleRejected };
};

const encryptionModesSeen = async ({ gameId }: { gameId: string }) => {
  const boards = (await readRecordings({ directory: FIXTURES })).filter(
    ({ path, status, body }) =>
      status === 200 && path.includes(gameId) && path.endsWith('/messages') && Array.isArray(body),
  );
  const modes = boards.flatMap(({ body }) =>
    (body as { encrypted: unknown }[]).map(({ encrypted }) => encrypted),
  );

  return { base64: modes.includes(1), rot13: modes.includes(2) };
};

const main = async () => {
  const config = loadConfig({ env: process.env });

  await rm(FIXTURES, { recursive: true, force: true });
  await mkdir(FIXTURES, { recursive: true });

  const throttle = createTokenBucket({
    capacity: config.mugloarBurst,
    refillPerSecond: config.mugloarRatePerSecond,
    now: () => performance.now(),
    sleep: (ms) => sleep(ms),
  });
  const client = createMugloarClient({
    config,
    fetchImpl: createRecordingFetch({ fetchImpl: fetch, directory: FIXTURES }),
    throttle,
  });
  const { gameId } = await client.startGame();
  const notFound = await rejectsWith(
    client.fetchAds({ gameId: UNKNOWN_GAME_ID }),
    GameNotFoundError,
  );
  const purchase = await client.buyItem({ gameId, itemId: HEALING_POTION_ID });
  const { gameOver, staleRejected } = await playToGameOver({ client, gameId });
  const { base64, rot13 } = await encryptionModesSeen({ gameId });
  const findings: Findings = {
    'encrypted: 1 (base64) ad': base64,
    'encrypted: 2 ad': rot13,
    'HTML 404 for an unknown gameId': notFound,
    'HTML 400 for a stale adId': staleRejected,
    'failed purchase (shoppingSuccess false)':
      purchase.status === 'ok' && !purchase.value.shoppingSuccess,
    '410 Game Over': gameOver,
  };

  console.log(`Captured game ${gameId} into ${FIXTURES}`);

  for (const [finding, captured] of Object.entries(findings)) {
    console.log(`${captured ? 'captured' : 'MISSING '}  ${finding}`);
  }
};

await main();
