import { RunStatusSchema } from '@dragons-game/contracts';
import type { GameView } from '@dragons-game/contracts';

export const hasActiveStatus = ({ game }: { game: GameView | undefined }) =>
  game?.status === RunStatusSchema.enum.active;
