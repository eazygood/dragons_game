import { GameIdSchema } from '@bigbank-dragon/contracts';
import type { ReactNode } from 'react';

import { GameUnavailable } from './GameUnavailable.tsx';

// A hand-edited URL never reaches the API: the id is checked before any request.
export const GameIdGate = ({
  rawGameId,
  children,
}: {
  rawGameId: string;
  children: (gameId: string) => ReactNode;
}) => {
  const parsedGameId = GameIdSchema.safeParse(rawGameId);

  if (!parsedGameId.success) {
    return <GameUnavailable reason="invalid_id" />;
  }

  return children(parsedGameId.data);
};
