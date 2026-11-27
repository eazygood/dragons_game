import type { Ad, ShopItem } from '@dragons-game/contracts';

import * as mugloarRepository from '../../repositories/mugloar-repository.ts';
import type { Logger, OrGameOver } from '../../types.ts';

// What the game offers right now, read from the upstream: ads change every turn, and the shop
// can differ between games.
export const findAds = async ({
  gameId,
  logger,
}: {
  gameId: string;
  logger: Logger;
}): Promise<OrGameOver<Ad[]>> => {
  const boardResult = await mugloarRepository.findAds({ gameId });

  if (boardResult.status === 'game_over') {
    return boardResult;
  }

  const { ads, droppedCount } = boardResult.value;

  // The rest of the board still plays, but a dropped ad is a shape or label the upstream had
  // never sent before, and unlogged it would only show as a quietly smaller board.
  if (droppedCount > 0) {
    logger.warn({ gameId, droppedCount }, 'ads dropped from the board');
  }

  return { status: 'ok', value: ads };
};

export const findShopItems = ({ gameId }: { gameId: string }): Promise<OrGameOver<ShopItem[]>> =>
  mugloarRepository.findShopItems({ gameId });
