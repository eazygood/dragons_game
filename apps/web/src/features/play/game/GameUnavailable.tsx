import { Link } from '@tanstack/react-router';

import { copy } from '../copy.ts';
import styles from './Panel.module.css';

export type UnavailableReason = 'invalid_id' | 'not_found' | 'bot_game';

// Retrying cannot change any of these, so the only way on is back to the start.
export const GameUnavailable = ({ reason }: { reason: UnavailableReason }) => (
  <section className={styles.panel}>
    <h2>{copy.unavailableGame[reason].title}</h2>
    <p>{copy.unavailableGame[reason].body}</p>
    <Link to="/play">{copy.unavailableGame.back}</Link>
  </section>
);
