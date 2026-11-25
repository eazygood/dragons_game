import { gamePaths } from '../src/api/game-paths.ts';
import {
  BOT_FINISHED_PROGRESS,
  BOT_GAME_ID,
  buildBotMoves,
  buildGameViewResponse,
  routeApi,
} from './api-fixtures.ts';
import { expect, test } from './guarded-test.ts';
import { expectNoHorizontalOverflow } from './layout.ts';

const BOT_BUTTON = 'Let the bot play';
const RUN_AGAIN_BUTTON = 'Run the bot again';
const NEXT_BOT_GAME_ID = 'e2e-bot-next';
const IN_PROGRESS = 'In progress…';
const REACHED_TARGET = 'Reached 1000 ✓ — final score 1240';
const SHOW_MOVES = 'Show moves';
const MOVE_LIST = 'Moves';
const SOLVE_LINE = 'Solved a “Sure thing” ad for 30 gold';
const BUY_LINE = 'Bought Healing potion';

test('lets the bot play and watches it pass the target', async ({ page }) => {
  // Flipped by the spec, not by a request count: the page may refetch on focus, which would
  // otherwise consume a scripted step before the in-progress state is asserted.
  let hasBotFinished = false;
  const gameId = BOT_GAME_ID;

  await routeApi({
    page,
    routes: {
      [`POST ${gamePaths.botGames()}`]: () => buildGameViewResponse({ gameId, status: 'active' }),
      [`GET ${gamePaths.game({ gameId })}`]: () =>
        hasBotFinished
          ? buildGameViewResponse({ gameId, status: 'abandoned', progress: BOT_FINISHED_PROGRESS })
          : buildGameViewResponse({ gameId, status: 'active' }),
      [`GET ${gamePaths.moves({ gameId })}`]: () => buildBotMoves(),
    },
  });

  await page.goto('/play');
  await page.getByRole('button', { name: BOT_BUTTON }).click();

  await expect(page).toHaveURL(`/watch/${gameId}`);
  await expect(page.getByText(IN_PROGRESS)).toBeVisible();

  hasBotFinished = true;

  await expect(page.getByText(REACHED_TARGET)).toBeVisible();

  await page.getByRole('checkbox', { name: SHOW_MOVES }).check();

  const moveLines = page.getByRole('list', { name: MOVE_LIST }).getByRole('listitem');

  await expect(moveLines).toHaveCount(buildBotMoves().length);
  await expect(moveLines.first()).toContainText(SOLVE_LINE);
  await expect(moveLines.last()).toContainText(BUY_LINE);

  await expectNoHorizontalOverflow({ page });
});

test('runs the bot again from a finished game and watches the new one', async ({ page }) => {
  await routeApi({
    page,
    routes: {
      [`POST ${gamePaths.botGames()}`]: () =>
        buildGameViewResponse({ gameId: NEXT_BOT_GAME_ID, status: 'active' }),
      [`GET ${gamePaths.game({ gameId: BOT_GAME_ID })}`]: () =>
        buildGameViewResponse({
          gameId: BOT_GAME_ID,
          status: 'abandoned',
          progress: BOT_FINISHED_PROGRESS,
        }),
      [`GET ${gamePaths.game({ gameId: NEXT_BOT_GAME_ID })}`]: () =>
        buildGameViewResponse({ gameId: NEXT_BOT_GAME_ID, status: 'active' }),
    },
  });

  await page.goto(`/watch/${BOT_GAME_ID}`);
  await expect(page.getByText(REACHED_TARGET)).toBeVisible();

  await page.getByRole('button', { name: RUN_AGAIN_BUTTON }).click();

  await expect(page).toHaveURL(`/watch/${NEXT_BOT_GAME_ID}`);
  await expect(page.getByText(IN_PROGRESS)).toBeVisible();
  await expectNoHorizontalOverflow({ page });
});
