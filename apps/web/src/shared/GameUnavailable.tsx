import { Link } from '@tanstack/react-router';

import { Panel } from './Panel.tsx';
import { focusOnMount } from './focus-on-mount.ts';
import { sharedCopy } from './shared-copy.ts';

type GameUnavailableProps =
  { reason: 'invalid_id' | 'not_found' | 'expired' } | { reason: 'bot_game'; gameId: string };

// Retrying cannot change any of these. A bot game can still be watched, an expired one can only
// be replaced by a new game, and the rest go back to start.
export const GameUnavailable = (props: GameUnavailableProps) => {
  const { title, body } = sharedCopy.unavailableGame[props.reason];
  const startLinkLabel =
    props.reason === 'expired' ? sharedCopy.unavailableGame.startNewGame : sharedCopy.backToStart;

  return (
    <Panel>
      <h2 ref={focusOnMount} tabIndex={-1}>
        {title}
      </h2>
      <p>{body}</p>
      {props.reason === 'bot_game' && (
        <Link to="/watch/$gameId" params={{ gameId: props.gameId }}>
          {sharedCopy.unavailableGame.watchBot}
        </Link>
      )}
      <Link to="/play">{startLinkLabel}</Link>
    </Panel>
  );
};
