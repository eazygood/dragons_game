import { GameIdSchema } from '@bigbank-dragon/contracts';
import { createFileRoute } from '@tanstack/react-router';

import { GameScreen } from '../../features/play/game/GameScreen.tsx';
import { InvalidGameId } from '../../features/play/game/InvalidGameId.tsx';

// A hand-edited URL never reaches the API: the id is checked before any request.
const GamePage = () => {
  const parsedGameId = GameIdSchema.safeParse(Route.useParams().gameId);

  if (!parsedGameId.success) {
    return <InvalidGameId />;
  }

  return <GameScreen key={parsedGameId.data} gameId={parsedGameId.data} />;
};

export const Route = createFileRoute('/play/$gameId')({ component: GamePage });
