import { useId } from 'react';

import { useStartBotGame, useStartGame } from '../../../api/game-mutations.ts';
import { Panel } from '../../../shared/Panel.tsx';
import { errorCopy } from '../../../shared/error-copy.ts';
import { focusOnMount } from '../../../shared/focus-on-mount.ts';
import { isLaunchLocked } from '../../../shared/launch-lock.ts';
import { sharedCopy } from '../../../shared/shared-copy.ts';
import { playCopy } from '../play-copy.ts';
import { ResumeGameForm } from './ResumeGameForm.tsx';
import errorStyles from '../../../shared/inline-error.module.css';

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
  const isStartLocked = isLaunchLocked({ mutations: [newGameMutation, botGameMutation] });
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
    <Panel titleId={titleId}>
      <h2 id={titleId} ref={focusOnMount} tabIndex={-1}>
        {playCopy.start.title}
      </h2>
      <button type="button" onClick={startGame} disabled={isStartLocked}>
        {newGameMutation.isPending ? playCopy.start.starting : playCopy.start.newGame}
      </button>
      <button type="button" onClick={startBotGame} disabled={isStartLocked}>
        {botGameMutation.isPending ? sharedCopy.botStarting : playCopy.start.botPlay}
      </button>
      {startError !== null && (
        <p role="alert" className={errorStyles.error}>
          {errorCopy({ error: startError })}
        </p>
      )}
      <ResumeGameForm onResume={onGameReady} />
    </Panel>
  );
};
