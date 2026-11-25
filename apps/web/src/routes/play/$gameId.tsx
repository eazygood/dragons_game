import { createFileRoute } from '@tanstack/react-router';

import { GameScreen } from '../../features/play/game/GameScreen.tsx';
import { GameIdGate } from '../../shared/GameIdGate.tsx';

const GamePage = () => (
  <GameIdGate rawGameId={Route.useParams().gameId}>
    {(gameId) => <GameScreen key={gameId} gameId={gameId} />}
  </GameIdGate>
);

export const Route = createFileRoute('/play/$gameId')({ component: GamePage });
