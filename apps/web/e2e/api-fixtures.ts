import {
  ApiErrorBodySchema,
  GameViewSchema,
  MoveListSchema,
  MoveResultSchema,
} from '@bigbank-dragon/contracts';
import type { ApiErrorCode, RunStatus } from '@bigbank-dragon/contracts';
import { STARTING_PROGRESS } from '@bigbank-dragon/contracts/test-support';
import type { Progress } from '@bigbank-dragon/contracts/test-support';
import type { Page, Request } from '@playwright/test';

export {
  SURE_AD_ID,
  SURE_AD_MESSAGE,
  STARTING_PROGRESS,
  buildTurnView,
} from '@bigbank-dragon/contracts/test-support';

export const PLAYER_GAME_ID = 'e2e-player';
export const BOT_GAME_ID = 'e2e-bot';
const SOLVE_REWARD = 30;

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

// Keys read 'METHOD /path'; a responder returns the JSON body of a 200 answer, or a `failWith`.
export type ApiRoutes = Record<string, () => unknown>;

class ApiFailure {
  readonly status: number;
  readonly body: unknown;

  constructor({ status, body }: { status: number; body: unknown }) {
    this.status = status;
    this.body = body;
  }
}

// Same envelope the API sends, so the client's own error parsing is what the spec exercises.
export const failWith = ({
  status,
  code,
  message = code,
}: {
  status: number;
  code: ApiErrorCode;
  message?: string;
}) => new ApiFailure({ status, body: ApiErrorBodySchema.parse({ error: { code, message } }) });

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

    const reply = respond();

    if (reply instanceof ApiFailure) {
      await route.fulfill({ status: reply.status, json: reply.body });

      return;
    }

    await route.fulfill({ json: reply });
  });
};
