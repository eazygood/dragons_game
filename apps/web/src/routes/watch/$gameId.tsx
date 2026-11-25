import { createFileRoute } from '@tanstack/react-router';

import { WatchScreen } from '../../features/watch/WatchScreen.tsx';
import { GameIdGate } from '../../shared/GameIdGate.tsx';

const WatchPage = () => (
  <GameIdGate rawGameId={Route.useParams().gameId}>
    {(gameId) => <WatchScreen key={gameId} gameId={gameId} />}
  </GameIdGate>
);

export const Route = createFileRoute('/watch/$gameId')({ component: WatchPage });
