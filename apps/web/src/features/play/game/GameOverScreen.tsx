import type { GameView } from '@bigbank-dragon/contracts';
import { Link } from '@tanstack/react-router';

import { copy } from '../copy.ts';
import styles from './Panel.module.css';

export const GameOverScreen = ({ game }: { game: GameView }) => (
  <section className={styles.panel}>
    <h2>{copy.gameOver.title}</h2>
    <p>{copy.gameOver.finalScore(game.state.score)}</p>
    <Link to="/play">{copy.gameOver.newGame}</Link>
  </section>
);
