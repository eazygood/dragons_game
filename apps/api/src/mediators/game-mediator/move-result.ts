import type { MoveResult } from '@bigbank-dragon/contracts';

import type { OrGameOver } from '../../entities/or-game-over.ts';
import type { PlayerMove } from '../../entities/turn-result.ts';

export const toMoveResult = ({
  playerMoveResult,
}: {
  playerMoveResult: OrGameOver<PlayerMove>;
}): OrGameOver<MoveResult> => {
  if (playerMoveResult.status === 'game_over') {
    return playerMoveResult;
  }

  const { state, status, success, message } = playerMoveResult.value;

  return { status: 'ok', value: { game: { state, status }, success, message } };
};
