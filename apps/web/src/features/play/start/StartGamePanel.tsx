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
  const newGameMutation = useStartGame();
  const botGameMutation = useStartBotGame();
  const titleId = useId();
  // isPending clears before the router navigation commits; a click in that gap would start a second game.
  const isStartLocked =
    newGameMutation.isPending ||
    newGameMutation.isSuccess ||
    botGameMutation.isPending ||
    botGameMutation.isSuccess;
  const startError = newGameMutation.error ?? botGameMutation.error;

  // Reset the other mutation so only the latest failure is shown.
  const startGame = () => {
    botGameMutation.reset();
    newGameMutation.mutate(undefined, { onSuccess: (game) => onGameReady(game.state.gameId) });
  };

  const startBotGame = () => {
    newGameMutation.reset();
    botGameMutation.mutate(undefined, { onSuccess: (game) => onBotGameReady(game.state.gameId) });
  };

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h2 id={titleId}>{copy.start.title}</h2>
      <button type="button" onClick={startGame} disabled={isStartLocked}>
        {newGameMutation.isPending ? copy.start.starting : copy.start.newGame}
      </button>
      <button type="button" onClick={startBotGame} disabled={isStartLocked}>
        {botGameMutation.isPending ? copy.start.botStarting : copy.start.botPlay}
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
