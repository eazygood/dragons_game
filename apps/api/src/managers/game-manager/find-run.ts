import type { Knex } from 'knex';

import type { GameRun } from '../../entities/game-run.ts';
import type { UpstreamResult } from '../../entities/upstream-result.ts';
import { GameNotFoundError, GameNotPlayableError } from '../../errors/errors.ts';
import { gameRunRepository } from '../../repositories/index.ts';

export const findRun = async ({ db, gameId }: { db: Knex; gameId: string }): Promise<GameRun> => {
  const run = await gameRunRepository.db.findOne({ db, gameId });

  if (!run) {
    throw new GameNotFoundError({ message: `Game ${gameId} not found` });
  }

  return run;
};

// A finished run answers game over without asking the upstream, which would say 410 anyway.
export const findPlayableRun = async ({
  db,
  gameId,
}: {
  db: Knex;
  gameId: string;
}): Promise<UpstreamResult<GameRun>> => {
  const run = await findRun({ db, gameId });

  if (run.strategy !== 'manual') {
    throw new GameNotPlayableError({ message: `Game ${gameId} is played by the bot` });
  }

  if (run.status !== 'active') {
    return { status: 'game_over' };
  }

  return { status: 'ok', value: run };
};
