import type { GameSnapshot } from '@bigbank-dragon/contracts';

import { mugloarApiAdapter } from '../../adapters/mugloar-api-adapter/index.ts';
import { GameStartWireSchema } from '../../adapters/mugloar-api-adapter/wire-schemas.ts';
import { UpstreamUnavailableError } from '../../errors/errors.ts';

// No game exists yet, so Game Over on a start is an upstream fault, not an ending.
const createOne = async (): Promise<GameSnapshot> => {
  const result = await mugloarApiAdapter.request({
    operation: 'start_game',
    method: 'POST',
    path: '/game/start',
    schema: GameStartWireSchema,
  });

  if (result.status === 'game_over') {
    throw new UpstreamUnavailableError({ message: 'start_game answered Game Over' });
  }

  return result.value;
};

export const mugloarRepository = { createOne };
