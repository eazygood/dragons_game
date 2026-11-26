import { createFileRoute } from '@tanstack/react-router';

import { GameScreen } from '../../features/play/game/GameScreen.tsx';
import { playCopy } from '../../features/play/play-copy.ts';
import { GameIdGate } from '../../shared/GameIdGate.tsx';
import { pageHead } from '../../shared/page-head.ts';

const GamePage = () => (
  <GameIdGate rawGameId={Route.useParams().gameId}>
    {(gameId) => <GameScreen key={gameId} gameId={gameId} />}
  </GameIdGate>
);

export const Route = createFileRoute('/play/$gameId')({
  component: GamePage,
  head: () => pageHead({ title: playCopy.game.title }),
});
