import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { StartGamePanel } from '../../features/play/start/StartGamePanel.tsx';

const PlayPage = () => {
  const navigate = useNavigate();

  const openGame = (gameId: string) => void navigate({ to: '/play/$gameId', params: { gameId } });

  return <StartGamePanel onGameReady={openGame} />;
};

export const Route = createFileRoute('/play/')({ component: PlayPage });
