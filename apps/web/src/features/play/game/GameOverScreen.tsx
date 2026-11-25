import type { GameView } from '@bigbank-dragon/contracts';
import { Link } from '@tanstack/react-router';

import { Panel } from '../../../shared/Panel.tsx';
import { focusOnMount } from '../../../shared/focus-on-mount.ts';
import { playCopy } from '../play-copy.ts';

// The screen swap unmounts the live region, so focus moves to the heading to announce the end.
export const GameOverScreen = ({ game }: { game: GameView }) => (
  <Panel>
    <h2 ref={focusOnMount} tabIndex={-1}>
      {playCopy.gameOver.title}
    </h2>
    <p>{playCopy.gameOver.finalScore(game.state.score)}</p>
    <Link to="/play">{playCopy.gameOver.newGame}</Link>
  </Panel>
);
