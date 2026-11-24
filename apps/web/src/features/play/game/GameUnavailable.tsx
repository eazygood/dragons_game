import { Link } from '@tanstack/react-router';

import { copy } from '../copy.ts';
import styles from './Panel.module.css';

export type UnavailableReason = 'invalid_id' | 'not_found' | 'bot_game';

// Retrying cannot change any of these. A bot game can still be watched; the rest go back to start.
export const GameUnavailable = ({
  reason,
  gameId,
}: {
  reason: UnavailableReason;
  gameId?: string;
}) => (
  <section className={styles.panel}>
    <h2>{copy.unavailableGame[reason].title}</h2>
    <p>{copy.unavailableGame[reason].body}</p>
    {reason === 'bot_game' && gameId !== undefined && (
      <Link to="/watch/$gameId" params={{ gameId }}>
        {copy.unavailableGame.watchBot}
      </Link>
    )}
    <Link to="/play">{copy.unavailableGame.back}</Link>
  </section>
);
