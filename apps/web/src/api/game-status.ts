import { RunStatusSchema } from '@bigbank-dragon/contracts';
import type { GameView } from '@bigbank-dragon/contracts';

export const hasActiveStatus = ({ game }: { game: GameView | undefined }) =>
  game?.status === RunStatusSchema.enum.active;
