import { gamePaths } from '../src/api/game-paths.ts';
import {
  PLAYER_GAME_ID,
  STARTING_PROGRESS,
  SURE_AD_ID,
  SURE_AD_MESSAGE,
  buildGameViewResponse,
  buildTurnView,
  failWith,
  routeApi,
} from './api-fixtures.ts';
import { expect, test } from './guarded-test.ts';
import { expectNoHorizontalOverflow } from './layout.ts';

const gameId = PLAYER_GAME_ID;
const GAME_KEY = `GET ${gamePaths.game({ gameId })}`;
const TURN_KEY = `GET ${gamePaths.turn({ gameId })}`;
const SOLVE_KEY = `POST ${gamePaths.solve({ gameId, adId: SURE_AD_ID })}`;

const SOLVE_BUTTON = `Solve: ${SURE_AD_MESSAGE}`;
const MOVE_FEEDBACK_REGION = 'Move result';
const TOO_MANY_REQUESTS = 'Too many requests in a short time. Wait a moment, then try again.';
const UPSTREAM_UNAVAILABLE =
  'The game is safe, but the Mugloar server is not answering. Try again.';
const GAME_OVER_HEADING = 'Game over';
const ADS_REGION = 'Ads';
const RETRY_BUTTON = 'Retry';
const EXPIRED_HEADING = 'This game has expired on the game server';
const START_NEW_GAME_LINK = 'Start a new game';
const START_HEADING = 'Start playing';
const UPSTREAM_FORGOT_GAME = 'The Mugloar server does not know this game';
// The client retries a failing read twice with backoff before it shows the error.
const READ_RETRIES_EXHAUSTED_TIMEOUT_MS = 15_000;

test('shows the end screen when the game ends under the player mid-game', async ({ page }) => {
  let hasGameEnded = false;

  await routeApi({
    page,
    routes: {
      [GAME_KEY]: () =>
        buildGameViewResponse({
          gameId,
          status: hasGameEnded ? 'game_over' : 'active',
          progress: STARTING_PROGRESS,
        }),
      [TURN_KEY]: () => buildTurnView({ gameId }),
      [SOLVE_KEY]: () => {
        hasGameEnded = true;

        return failWith({ status: 410, code: 'game_over' });
      },
    },
  });

  await page.goto(`/play/${gameId}`);
  await page.getByRole('button', { name: SOLVE_BUTTON }).click();

  await expect(page.getByRole('heading', { name: GAME_OVER_HEADING })).toBeVisible();
  await expect(page.getByText(`Final score: ${STARTING_PROGRESS.score}`)).toBeVisible();
});

test('tells the player to wait when a move is rate limited, and keeps the board', async ({
  page,
}) => {
  await routeApi({
    page,
    routes: {
      [GAME_KEY]: () => buildGameViewResponse({ gameId, status: 'active' }),
      [TURN_KEY]: () => buildTurnView({ gameId }),
      [SOLVE_KEY]: () => failWith({ status: 429, code: 'too_many_requests' }),
    },
  });

  await page.goto(`/play/${gameId}`);
  await page.getByRole('button', { name: SOLVE_BUTTON }).click();

  await expect(page.getByRole('status', { name: MOVE_FEEDBACK_REGION })).toHaveText(
    TOO_MANY_REQUESTS,
  );
  await expect(page.getByRole('button', { name: SOLVE_BUTTON })).toBeEnabled();
});

test('says an idle game has expired, with a way to start over and no retry', async ({ page }) => {
  await routeApi({
    page,
    routes: {
      [GAME_KEY]: () => buildGameViewResponse({ gameId, status: 'active' }),
      [TURN_KEY]: () => failWith({ status: 404, code: 'not_found', message: UPSTREAM_FORGOT_GAME }),
    },
  });

  await page.goto(`/play/${gameId}`);

  await expect(page.getByRole('heading', { name: EXPIRED_HEADING })).toBeVisible();
  await expect(page.getByRole('button', { name: RETRY_BUTTON })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expectNoHorizontalOverflow({ page });

  await page.getByRole('link', { name: START_NEW_GAME_LINK }).click();

  await expect(page).toHaveURL('/play');
  await expect(page.getByRole('heading', { name: START_HEADING })).toBeVisible();
});

test('offers a retry when the upstream is down on load, then recovers', async ({ page }) => {
  let isUpstreamUp = false;

  await routeApi({
    page,
    routes: {
      [GAME_KEY]: () =>
        isUpstreamUp
          ? buildGameViewResponse({ gameId, status: 'active' })
          : failWith({ status: 502, code: 'upstream_unavailable' }),
      [TURN_KEY]: () => buildTurnView({ gameId }),
    },
  });

  await page.goto(`/play/${gameId}`);

  const alert = page.getByRole('alert');

  await expect(alert).toContainText(UPSTREAM_UNAVAILABLE, {
    timeout: READ_RETRIES_EXHAUSTED_TIMEOUT_MS,
  });

  isUpstreamUp = true;
  await alert.getByRole('button', { name: RETRY_BUTTON }).click();

  await expect(page.getByRole('region', { name: ADS_REGION })).toBeVisible();
  await expect(alert).toHaveCount(0);
});
