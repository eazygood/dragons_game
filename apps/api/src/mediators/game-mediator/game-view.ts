import type { GameView, MoveResult } from '@bigbank-dragon/contracts';

import type { GameRun } from '../../entities/game-run.ts';
import type { OrGameOver } from '../../entities/or-game-over.ts';
import type { PlayerMove } from '../../entities/turn-result.ts';
import { stateFromRun } from '../../managers/game-manager/index.ts';

export const toGameView = ({ run }: { run: GameRun }): GameView => ({
  state: stateFromRun({ run }),
  status: run.status,
});

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
