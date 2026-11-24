import type { TurnView } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { Logger } from '../../config/logger.ts';
import type { UpstreamResult } from '../../entities/upstream-result.ts';
import { adviseTurn } from '../../managers/advisor-manager/index.ts';
import { toGameView } from './game-view.ts';

export const findTurn = async ({
  db,
  gameId,
  logger,
}: {
  db: Knex;
  gameId: string;
  logger: Logger;
}): Promise<UpstreamResult<TurnView>> => {
  const turn = await adviseTurn({ db, gameId, logger });

  if (turn.status === 'game_over') {
    return turn;
  }

  const { run, board, shop, recommendation } = turn.value;

  return { status: 'ok', value: { game: toGameView({ run }), board, shop, recommendation } };
};
