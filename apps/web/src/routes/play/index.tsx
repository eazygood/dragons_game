import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { playCopy } from '../../features/play/play-copy.ts';
import { StartGamePanel } from '../../features/play/start/StartGamePanel.tsx';
import { pageHead } from '../../shared/page-head.ts';

const PlayPage = () => {
  const navigate = useNavigate();

  const openGame = (gameId: string) => void navigate({ to: '/play/$gameId', params: { gameId } });
  const openBotGame = (gameId: string) =>
    void navigate({ to: '/watch/$gameId', params: { gameId } });

  return <StartGamePanel onGameReady={openGame} onBotGameReady={openBotGame} />;
};

export const Route = createFileRoute('/play/')({
  component: PlayPage,
  head: () => pageHead({ title: playCopy.start.title }),
});
