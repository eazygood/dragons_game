import { GameIdSchema } from '@bigbank-dragon/contracts';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';

import { copy } from '../copy.ts';
import styles from './StartGamePanel.module.css';

// UX only: the API re-validates the id, this just keeps a typo out of the URL.
export const ResumeGameForm = ({ onResume }: { onResume: (gameId: string) => void }) => {
  const [typedGameId, setTypedGameId] = useState('');
  const inputId = useId();
  const errorId = useId();
  const trimmedGameId = typedGameId.trim();
  const isValid = GameIdSchema.safeParse(trimmedGameId).success;
  const showError = trimmedGameId.length > 0 && !isValid;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (isValid) {
      onResume(trimmedGameId);
    }
  };

  return (
    <form className={styles.resumeForm} onSubmit={handleSubmit}>
      <label htmlFor={inputId}>{copy.start.resumeLabel}</label>
      <div className={styles.resumeRow}>
        <input
          id={inputId}
          value={typedGameId}
          onChange={(event) => setTypedGameId(event.target.value)}
          aria-invalid={showError}
          aria-describedby={showError ? errorId : undefined}
          autoComplete="off"
        />
        <button type="submit" disabled={!isValid}>
          {copy.start.resume}
        </button>
      </div>
      {showError && (
        <p id={errorId} className={styles.error}>
          {copy.start.invalidGameId}
        </p>
      )}
    </form>
  );
};
