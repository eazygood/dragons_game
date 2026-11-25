import { Link } from '@tanstack/react-router';

import { Panel } from './Panel.tsx';
import { sharedCopy } from './shared-copy.ts';

type GameUnavailableProps =
  { reason: 'invalid_id' | 'not_found' } | { reason: 'bot_game'; gameId: string };

// Retrying cannot change any of these. A bot game can still be watched; the rest go back to start.
export const GameUnavailable = (props: GameUnavailableProps) => {
  const { title, body } = sharedCopy.unavailableGame[props.reason];

  return (
    <Panel>
      <h2>{title}</h2>
      <p>{body}</p>
      {props.reason === 'bot_game' && (
        <Link to="/watch/$gameId" params={{ gameId: props.gameId }}>
          {sharedCopy.unavailableGame.watchBot}
        </Link>
      )}
      <Link to="/play">{sharedCopy.unavailableGame.back}</Link>
    </Panel>
  );
};
