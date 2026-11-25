import { gamePaths } from '../src/api/game-paths.ts';
import {
  PLAYER_GAME_ID,
  RECOMMENDED_AD_ID,
  RECOMMENDED_AD_MESSAGE,
  SOLVED_PROGRESS,
  STARTING_PROGRESS,
  buildGameViewResponse,
  buildSolveResult,
  buildTurnView,
  routeApi,
} from './api-fixtures.ts';
import { expect, test } from './guarded-test.ts';
import { expectNoHorizontalOverflow } from './layout.ts';

const NEW_GAME_BUTTON = 'New game';
const ADVICE_REGION = 'Engine advice';
const ADVICE_TEXT = `Solve “${RECOMMENDED_AD_MESSAGE}”.`;
const SOLVE_BUTTON = `Solve: ${RECOMMENDED_AD_MESSAGE}`;
const STATUS_BAR = 'Game status';
const MOVE_FEEDBACK = 'Success. You successfully defended the village';

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
      [`POST ${gamePaths.solve({ gameId, adId: RECOMMENDED_AD_ID })}`]: () => {
        wasSolvePosted = true;

        return buildSolveResult({ gameId, progress: SOLVED_PROGRESS });
      },
    },
  });

  await page.goto('/play');
  await page.getByRole('button', { name: NEW_GAME_BUTTON }).click();

  const statusBar = page.getByLabel(STATUS_BAR);

  await expect(page).toHaveURL(`/play/${gameId}`);
  await expect(page.getByRole('region', { name: ADVICE_REGION })).toContainText(ADVICE_TEXT);
  await expect(statusBar).toContainText(`Score${STARTING_PROGRESS.score}`);

  await page.getByRole('button', { name: SOLVE_BUTTON }).click();

  await expect(statusBar).toContainText(`Score${SOLVED_PROGRESS.score}`);
  await expect(page.getByRole('status')).toHaveText(MOVE_FEEDBACK);

  await expectNoHorizontalOverflow({ page });
});
