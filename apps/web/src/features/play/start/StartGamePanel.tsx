import { useId } from 'react';

import { useStartGame } from '../../../api/game-mutations.ts';
import { copy } from '../copy.ts';
import { errorCopy } from '../error-copy.ts';
import { ResumeGameForm } from './ResumeGameForm.tsx';
import styles from './StartGamePanel.module.css';

export const StartGamePanel = ({ onGameReady }: { onGameReady: (gameId: string) => void }) => {
  const startGame = useStartGame();
  const titleId = useId();

  const handleNewGame = () =>
    startGame.mutate(undefined, { onSuccess: (game) => onGameReady(game.state.gameId) });

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h2 id={titleId}>{copy.start.title}</h2>
      <button type="button" onClick={handleNewGame} disabled={startGame.isPending}>
        {startGame.isPending ? copy.start.starting : copy.start.newGame}
      </button>
      {startGame.isError && (
        <p role="alert" className={styles.error}>
          {errorCopy({ error: startGame.error })}
        </p>
      )}
      <ResumeGameForm onResume={onGameReady} />
    </section>
  );
};
