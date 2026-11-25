import { useId } from 'react';

import { useStartBotGame, useStartGame } from '../../../api/game-mutations.ts';
import { copy } from '../copy.ts';
import { errorCopy } from '../error-copy.ts';
import { ResumeGameForm } from './ResumeGameForm.tsx';
import styles from './StartGamePanel.module.css';

export const StartGamePanel = ({
  onGameReady,
  onBotGameReady,
}: {
  onGameReady: (gameId: string) => void;
  onBotGameReady: (gameId: string) => void;
}) => {
  const startGame = useStartGame();
  const startBotGame = useStartBotGame();
  const titleId = useId();
  // isPending clears before the router navigation commits; a click in that gap would start a second game.
  const isStartLocked =
    startGame.isPending || startGame.isSuccess || startBotGame.isPending || startBotGame.isSuccess;
  const startError = startGame.error ?? startBotGame.error;

  // Reset the other mutation so only the latest failure is shown.
  const handleNewGame = () => {
    startBotGame.reset();
    startGame.mutate(undefined, { onSuccess: (game) => onGameReady(game.state.gameId) });
  };

  const handleBotGame = () => {
    startGame.reset();
    startBotGame.mutate(undefined, { onSuccess: (game) => onBotGameReady(game.state.gameId) });
  };

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h2 id={titleId}>{copy.start.title}</h2>
      <button type="button" onClick={handleNewGame} disabled={isStartLocked}>
        {startGame.isPending ? copy.start.starting : copy.start.newGame}
      </button>
      <button type="button" onClick={handleBotGame} disabled={isStartLocked}>
        {startBotGame.isPending ? copy.start.botStarting : copy.start.botPlay}
      </button>
      {startError !== null && (
        <p role="alert" className={styles.error}>
          {errorCopy({ error: startError })}
        </p>
      )}
      <ResumeGameForm onResume={onGameReady} />
    </section>
  );
};
