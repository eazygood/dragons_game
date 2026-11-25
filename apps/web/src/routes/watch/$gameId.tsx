import { GameIdSchema } from '@bigbank-dragon/contracts';
import { createFileRoute } from '@tanstack/react-router';

import { GameUnavailable } from '../../features/play/game/GameUnavailable.tsx';
import { WatchScreen } from '../../features/watch/WatchScreen.tsx';

// A hand-edited URL never reaches the API: the id is checked before any request.
const WatchPage = () => {
  const parsedGameId = GameIdSchema.safeParse(Route.useParams().gameId);

  if (!parsedGameId.success) {
    return <GameUnavailable reason="invalid_id" />;
  }

  return <WatchScreen key={parsedGameId.data} gameId={parsedGameId.data} />;
};

export const Route = createFileRoute('/watch/$gameId')({ component: WatchPage });
