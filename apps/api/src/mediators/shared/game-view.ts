import type { GameView } from '@bigbank-dragon/contracts';

import type { GameRun } from '../../entities/game-run.ts';
import { stateFromRun } from '../../managers/game-manager/index.ts';

export const toGameView = ({ run }: { run: GameRun }): GameView => ({
  state: stateFromRun({ run }),
  status: run.status,
});
