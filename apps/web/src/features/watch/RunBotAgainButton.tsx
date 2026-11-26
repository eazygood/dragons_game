import { useNavigate } from '@tanstack/react-router';

import { useStartBotGame } from '../../api/game-mutations.ts';
import { errorCopy } from '../../shared/error-copy.ts';
import { isLaunchLocked } from '../../shared/launch-lock.ts';
import { sharedCopy } from '../../shared/shared-copy.ts';
import styles from './RunBotAgainButton.module.css';
import { watchCopy } from './watch-copy.ts';

export const RunBotAgainButton = () => {
  const navigate = useNavigate();
  const botGameMutation = useStartBotGame();

  const runBotAgain = () =>
    botGameMutation.mutate(undefined, {
      onSuccess: (game) =>
        void navigate({ to: '/watch/$gameId', params: { gameId: game.state.gameId } }),
    });

  return (
    <>
      <button
        type="button"
        onClick={runBotAgain}
        disabled={isLaunchLocked({ mutations: [botGameMutation] })}
      >
        {botGameMutation.isPending ? sharedCopy.botStarting : watchCopy.runAgain}
      </button>
      {botGameMutation.error !== null && (
        <p role="alert" className={styles.error}>
          {errorCopy({ error: botGameMutation.error })}
        </p>
      )}
    </>
  );
};
