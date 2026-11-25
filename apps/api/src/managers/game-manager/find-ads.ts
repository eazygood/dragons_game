import type { Ad } from '@bigbank-dragon/contracts';

import type { OrGameOver } from '../../entities/or-game-over.ts';
import { adRepository } from '../../repositories/index.ts';

export const findAds = ({ gameId }: { gameId: string }): Promise<OrGameOver<Ad[]>> =>
  adRepository.mugloar.findMany({ gameId });
