import { useNavigate } from '@tanstack/react-router';

import { useStartBotGame } from '../../api/game-mutations.ts';
import { errorCopy } from '../play/error-copy.ts';
import styles from './WatchScreen.module.css';
import { watchCopy } from './watch-copy.ts';

export const RunBotAgainButton = () => {
  const navigate = useNavigate();
  const botGameMutation = useStartBotGame();
  // isPending clears before the router navigation commits; a click in that gap would start a second game.
  const isLocked = botGameMutation.isPending || botGameMutation.isSuccess;

  const runBotAgain = () =>
    botGameMutation.mutate(undefined, {
      onSuccess: (game) =>
        void navigate({ to: '/watch/$gameId', params: { gameId: game.state.gameId } }),
    });

  return (
    <>
      <button type="button" onClick={runBotAgain} disabled={isLocked}>
        {botGameMutation.isPending ? watchCopy.runAgainStarting : watchCopy.runAgain}
      </button>
      {botGameMutation.error !== null && (
        <p role="alert" className={styles.error}>
          {errorCopy({ error: botGameMutation.error })}
        </p>
      )}
    </>
  );
};
