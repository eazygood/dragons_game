import {
  GameViewSchema,
  MoveListSchema,
  MoveResultSchema,
  TurnViewSchema,
} from '@bigbank-dragon/contracts';
import type { RunStatus } from '@bigbank-dragon/contracts';
import type { Page, Request } from '@playwright/test';

export const PLAYER_GAME_ID = 'e2e-player';
export const BOT_GAME_ID = 'e2e-bot';
export const RECOMMENDED_AD_ID = 'sure1';
export const RECOMMENDED_AD_MESSAGE = 'Help defend the village';
const SOLVE_REWARD = 30;

type Progress = { score: number; gold: number; turn: number };

export const STARTING_PROGRESS: Progress = { score: 0, gold: 0, turn: 0 };
export const SOLVED_PROGRESS: Progress = { score: SOLVE_REWARD, gold: SOLVE_REWARD, turn: 1 };
export const BOT_FINISHED_PROGRESS: Progress = { score: 1240, gold: 310, turn: 61 };

export const buildGameViewResponse = ({
  gameId,
  status,
  progress = STARTING_PROGRESS,
}: {
  gameId: string;
  status: RunStatus;
  progress?: Progress;
}) =>
  GameViewSchema.parse({
    state: { gameId, lives: 3, dragonLevel: 0, ...progress },
    status,
  });

export const buildTurnView = ({ gameId, progress }: { gameId: string; progress: Progress }) =>
  TurnViewSchema.parse({
    game: buildGameViewResponse({ gameId, status: 'active', progress }),
    board: [
      {
        adId: RECOMMENDED_AD_ID,
        message: RECOMMENDED_AD_MESSAGE,
        reward: SOLVE_REWARD,
        expiresIn: 5,
        probability: 'Sure thing',
        wasEncrypted: false,
        advice: { verdict: 'recommended', estimatedProbability: 0.95, expectedValue: 25 },
      },
      {
        adId: 'risky1',
        message: 'Escort the merchant through the swamp',
        reward: 60,
        expiresIn: 3,
        probability: 'Risky',
        wasEncrypted: false,
        advice: { verdict: 'long_shot', estimatedProbability: 0.4, expectedValue: -18 },
      },
    ],
    shop: [
      { id: 'hpot', name: 'Healing potion', cost: 50 },
      { id: 'cs', name: 'Claw Sharpening', cost: 100 },
    ],
    recommendation: {
      kind: 'solve',
      adId: RECOMMENDED_AD_ID,
      reasoning: {
        rule: 'best_expected_value',
        estimatedProbability: 0.95,
        expectedValue: 25,
        consideredCount: 2,
      },
    },
  });

export const buildSolveResult = ({ gameId, progress }: { gameId: string; progress: Progress }) =>
  MoveResultSchema.parse({
    game: buildGameViewResponse({ gameId, status: 'active', progress }),
    success: true,
    message: 'You successfully defended the village',
  });

export const buildBotMoves = () =>
  MoveListSchema.parse([
    {
      kind: 'solve',
      turn: 4,
      success: true,
      probability: 'Sure thing',
      reward: 30,
      estimatedProbability: 0.95,
      expectedValue: 25,
      rule: 'best_expected_value',
    },
    {
      kind: 'buy',
      turn: 3,
      success: true,
      itemName: 'Healing potion',
      cost: 50,
      rule: 'survival_floor',
    },
  ]);

export const API_ROUTE_PATTERN = '**/api/**';

// Keys read 'METHOD /path'; a responder returns the JSON body of a 200 answer.
export type ApiRoutes = Record<string, () => unknown>;

export const requestKey = ({ request }: { request: Request }) =>
  `${request.method()} ${new URL(request.url()).pathname}`;

// Keys it does not script fall through to the deny-all route that `guarded-test.ts` installs.
export const routeApi = async ({ page, routes }: { page: Page; routes: ApiRoutes }) => {
  await page.route(API_ROUTE_PATTERN, async (route) => {
    const respond = routes[requestKey({ request: route.request() })];

    if (!respond) {
      await route.fallback();

      return;
    }

    await route.fulfill({ json: respond() });
  });
};
