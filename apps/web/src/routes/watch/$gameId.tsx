import { createFileRoute } from '@tanstack/react-router';

import { WatchScreen } from '../../features/watch/WatchScreen.tsx';
import { watchCopy } from '../../features/watch/watch-copy.ts';
import { GameIdGate } from '../../shared/GameIdGate.tsx';
import { pageHead } from '../../shared/page-head.ts';

const WatchPage = () => (
  <GameIdGate rawGameId={Route.useParams().gameId}>
    {(gameId) => <WatchScreen key={gameId} gameId={gameId} />}
  </GameIdGate>
);

export const Route = createFileRoute('/watch/$gameId')({
  component: WatchPage,
  head: () => pageHead({ title: watchCopy.title }),
});
