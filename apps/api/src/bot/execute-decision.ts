import type { Ad, Decision, GameState, ShopItem } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { UpstreamResult } from '../adapters/mugloar-api-adapter/index.ts';
import type { GameRun } from '../entities/game-run.ts';
import { PersistenceFailedError } from '../errors/errors.ts';
import { buyItem, solveAd } from '../managers/game-manager/index.ts';
import type { BotLogger } from './types.ts';

type TurnContext = { db: Knex; run: GameRun; state: GameState };

export const execute = ({
  context,
  decision,
  board,
  shop,
}: {
  context: TurnContext;
  decision: Exclude<Decision, { kind: 'stop' }>;
  board: Ad[];
  shop: ShopItem[];
}): Promise<UpstreamResult<GameState>> => {
  if (decision.kind === 'solve') {
    const ad = board.find((candidate) => candidate.adId === decision.adId);

    if (!ad) {
      throw new Error(`Decision names ad ${decision.adId}, which is not on the board`);
    }

    return solveAd({ ...context, ad, reasoning: decision.reasoning });
  }

  const item = shop.find((candidate) => candidate.id === decision.itemId);

  if (!item) {
    throw new Error(`Decision names item ${decision.itemId}, which is not in the shop`);
  }

  return buyItem({ ...context, item });
};

// The one error a game outlives (spec §6): the upstream turn already happened,
// so losing its local record must not end the real game.
export const keepPlayingOnPersistenceFailure = async ({
  action,
  logger,
}: {
  action: Promise<UpstreamResult<GameState>>;
  logger: BotLogger;
}): Promise<UpstreamResult<GameState>> => {
  try {
    return await action;
  } catch (error) {
    if (!(error instanceof PersistenceFailedError)) {
      throw error;
    }

    logger.warn({ err: error, turn: error.state.turn }, 'turn not persisted; playing on');
    return { status: 'ok', value: error.state };
  }
};
