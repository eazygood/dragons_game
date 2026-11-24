import { Link } from '@tanstack/react-router';

import { copy } from '../copy.ts';
import styles from './Panel.module.css';

export const InvalidGameId = () => (
  <section className={styles.panel}>
    <h2>{copy.invalidGame.title}</h2>
    <p>{copy.invalidGame.body}</p>
    <Link to="/play">{copy.invalidGame.back}</Link>
  </section>
);
