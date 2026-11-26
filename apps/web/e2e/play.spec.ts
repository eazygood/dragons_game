import { gamePaths } from '../src/api/game-paths.ts';
import {
  PLAYER_GAME_ID,
  SOLVED_PROGRESS,
  STARTING_PROGRESS,
  SURE_AD_ID,
  SURE_AD_MESSAGE,
  buildGameViewResponse,
  buildSolveResult,
  buildTurnView,
  routeApi,
} from './api-fixtures.ts';
import { expectDocumentTitle } from './document-head.ts';
import { expect, test } from './guarded-test.ts';
import {
  expectBoardLayoutForWidth,
  expectContentWithinCard,
  expectNoHorizontalOverflow,
} from './layout.ts';

const NEW_GAME_BUTTON = 'New game';
const ADVICE_REGION = 'Engine advice';
const ADVICE_TEXT = `Solve “${SURE_AD_MESSAGE}”.`;
const SOLVE_BUTTON = `Solve: ${SURE_AD_MESSAGE}`;
const STATUS_BAR = 'Game status';
const MOVE_FEEDBACK_REGION = 'Move result';
const MOVE_FEEDBACK = 'Success. You successfully defended the village';
const ADS_REGION = 'Ads';
const SHOP_REGION = 'Shop';
const START_TITLE = 'Start playing';
const GAME_TITLE = 'Your game';
const RESUME_BUTTON = 'Resume';

test('keeps the whole start panel inside its card and the viewport', async ({ page }) => {
  await page.goto('/play');

  const startPanel = page.getByRole('region', { name: START_TITLE });

  await expect(startPanel).toBeVisible();
  await expect(startPanel.getByRole('button', { name: RESUME_BUTTON })).toBeInViewport({
    ratio: 1,
  });
  await expectContentWithinCard({ card: startPanel });
  await expectNoHorizontalOverflow({ page });
});

test('starts a game, follows the advice and sees the score move', async ({ page }) => {
  let wasSolvePosted = false;
  const progressToServe = () => (wasSolvePosted ? SOLVED_PROGRESS : STARTING_PROGRESS);
  const gameId = PLAYER_GAME_ID;

  await routeApi({
    page,
    routes: {
      [`POST ${gamePaths.games()}`]: () => buildGameViewResponse({ gameId, status: 'active' }),
      [`GET ${gamePaths.game({ gameId })}`]: () =>
        buildGameViewResponse({ gameId, status: 'active', progress: progressToServe() }),
      [`GET ${gamePaths.turn({ gameId })}`]: () =>
        buildTurnView({ gameId, progress: progressToServe() }),
      [`POST ${gamePaths.solve({ gameId, adId: SURE_AD_ID })}`]: () => {
        wasSolvePosted = true;

        return buildSolveResult({ gameId, progress: SOLVED_PROGRESS });
      },
    },
  });

  await page.goto('/play');
  await expectDocumentTitle({ page, routeTitle: START_TITLE });
  await expectNoHorizontalOverflow({ page });
  await page.getByRole('button', { name: NEW_GAME_BUTTON }).click();

  const statusBar = page.getByLabel(STATUS_BAR);

  await expect(page).toHaveURL(`/play/${gameId}`);
  await expectDocumentTitle({ page, routeTitle: GAME_TITLE });
  await expect(page.getByRole('region', { name: ADVICE_REGION })).toContainText(ADVICE_TEXT);
  await expect(statusBar).toContainText(`Score${STARTING_PROGRESS.score}`);
  await expectBoardLayoutForWidth({
    page,
    board: page.getByRole('region', { name: ADS_REGION }),
    shop: page.getByRole('region', { name: SHOP_REGION }),
  });
  await expectNoHorizontalOverflow({ page });

  await page.getByRole('button', { name: SOLVE_BUTTON }).click();

  await expect(statusBar).toContainText(`Score${SOLVED_PROGRESS.score}`);
  await expect(page.getByRole('status', { name: MOVE_FEEDBACK_REGION })).toHaveText(MOVE_FEEDBACK);

  await expectNoHorizontalOverflow({ page });
});
