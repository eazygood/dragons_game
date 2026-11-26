import { GameIdSchema } from '@dragons-game/contracts';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';

import { playCopy } from '../play-copy.ts';
import errorStyles from '../../../shared/inline-error.module.css';
import styles from './ResumeGameForm.module.css';

// UX only: the API re-validates the id, this just keeps a typo out of the URL.
export const ResumeGameForm = ({ onResume }: { onResume: (gameId: string) => void }) => {
  const [typedGameId, setTypedGameId] = useState('');
  const inputId = useId();
  const errorId = useId();
  const trimmedGameId = typedGameId.trim();
  const isValid = GameIdSchema.safeParse(trimmedGameId).success;
  const shouldShowError = trimmedGameId.length > 0 && !isValid;

  const resumeGame = (event: FormEvent) => {
    event.preventDefault();

    if (isValid) {
      onResume(trimmedGameId);
    }
  };

  return (
    <form className={styles.form} onSubmit={resumeGame}>
      <label htmlFor={inputId}>{playCopy.start.resumeLabel}</label>
      <div className={styles.row}>
        <input
          id={inputId}
          value={typedGameId}
          onChange={(event) => setTypedGameId(event.target.value)}
          aria-invalid={shouldShowError}
          aria-describedby={shouldShowError ? errorId : undefined}
          autoComplete="off"
        />
        <button type="submit" disabled={!isValid}>
          {playCopy.start.resume}
        </button>
      </div>
      {shouldShowError && (
        <p id={errorId} className={errorStyles.error}>
          {playCopy.start.invalidGameId}
        </p>
      )}
    </form>
  );
};
