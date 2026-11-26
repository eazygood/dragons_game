import type { Move } from '@dragons-game/contracts';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { gameKeys } from '../src/api/game-queries.ts';
import {
  MOVE_HISTORY_POLL_INTERVAL_MS,
  WATCH_POLL_INTERVAL_MS,
} from '../src/api/poll-intervals.ts';
import { sharedCopy } from '../src/shared/shared-copy.ts';
import { WatchScreen } from '../src/features/watch/WatchScreen.tsx';
import { createQueryClient } from '../src/query-client.ts';
import { respondInSequence, respondOk, respondWith, stubApi } from './fetch-stub.ts';
import {
  ABOVE_TARGET,
  BUY_MOVE,
  GAME_ID,
  GAME_ROUTE,
  GAME_VIEW,
  INTERVALS_AFTER_FINISH,
  MOVES_ROUTE,
  SHOW_MOVES,
  SOLVE_MOVE,
  buildGameView,
} from './fixtures.ts';
import { renderInRouter } from './render.tsx';

const FINISHED_GAME = buildGameView({ status: 'abandoned', score: ABOVE_TARGET });
const LATE_BUY_MOVE: Move = { ...BUY_MOVE, turn: 5, success: true };

const showMoves = async () =>
  userEvent.click(await screen.findByRole('checkbox', { name: SHOW_MOVES }));

afterEach(() => {
  vi.useRealTimers();
});

describe('the bot move log while the game runs', () => {
  it('stops refreshing moves once the game has finished', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const api = stubApi({
      [GAME_ROUTE]: respondInSequence({
        responders: [
          respondOk({ body: GAME_VIEW }),
          respondOk({ body: GAME_VIEW }),
          respondOk({ body: GAME_VIEW }),
          respondOk({ body: FINISHED_GAME }),
        ],
      }),
      [MOVES_ROUTE]: respondOk({ body: [SOLVE_MOVE] }),
    });

    renderInRouter(<WatchScreen gameId={GAME_ID} />);
    await showMoves();
    await screen.findByRole('list');
    await vi.advanceTimersByTimeAsync(MOVE_HISTORY_POLL_INTERVAL_MS);

    expect(api.callCountOf(MOVES_ROUTE)).toBeGreaterThan(1);

    await vi.advanceTimersByTimeAsync(WATCH_POLL_INTERVAL_MS);
    await screen.findByText(/^Reached/);
    // A tick already due when the game finished may still land; later ones must not.
    await vi.advanceTimersByTimeAsync(MOVE_HISTORY_POLL_INTERVAL_MS);
    const callsWhenSettled = api.callCountOf(MOVES_ROUTE);

    await vi.advanceTimersByTimeAsync(MOVE_HISTORY_POLL_INTERVAL_MS * INTERVALS_AFTER_FINISH);

    expect(api.callCountOf(MOVES_ROUTE)).toBe(callsWhenSettled);
  });

  it('polls the moves less often than the game status', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const api = stubApi({
      [GAME_ROUTE]: respondOk({ body: GAME_VIEW }),
      [MOVES_ROUTE]: respondOk({ body: [SOLVE_MOVE] }),
    });

    renderInRouter(<WatchScreen gameId={GAME_ID} />);
    await showMoves();
    await screen.findByRole('list');
    await vi.advanceTimersByTimeAsync(MOVE_HISTORY_POLL_INTERVAL_MS);

    expect(api.callCountOf(MOVES_ROUTE)).toBeLessThan(api.callCountOf(GAME_ROUTE));
  });

  it('shows the moves made just before the game finished', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const api = stubApi({
      [GAME_ROUTE]: respondInSequence({
        responders: [respondOk({ body: GAME_VIEW }), respondOk({ body: FINISHED_GAME })],
      }),
      [MOVES_ROUTE]: () =>
        respondOk({
          body: api.callCountOf(GAME_ROUTE) >= 2 ? [LATE_BUY_MOVE, SOLVE_MOVE] : [SOLVE_MOVE],
        })(),
    });

    renderInRouter(<WatchScreen gameId={GAME_ID} />, { queryClient: createQueryClient() });
    await screen.findByRole('checkbox', { name: SHOW_MOVES });
    // Half an interval out of phase, the moves poll cannot be due when the game finishes.
    await vi.advanceTimersByTimeAsync(WATCH_POLL_INTERVAL_MS / 2);
    await showMoves();
    await screen.findByText(/^Turn 4/);
    await vi.advanceTimersByTimeAsync(WATCH_POLL_INTERVAL_MS);
    await screen.findByText(/^Reached/);

    expect(await screen.findByText(/^Turn 5 · Bought/)).toBeVisible();
  });

  it('keeps the last loaded moves and says the refresh failed when a poll fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stubApi({
      [GAME_ROUTE]: respondOk({ body: GAME_VIEW }),
      [MOVES_ROUTE]: respondInSequence({
        responders: [
          respondOk({ body: [SOLVE_MOVE] }),
          respondWith({
            status: 502,
            body: { error: { code: 'upstream_unavailable', message: 'down' } },
          }),
        ],
      }),
    });

    const { queryClient } = renderInRouter(<WatchScreen gameId={GAME_ID} />);

    await showMoves();
    await screen.findByRole('list');
    await vi.advanceTimersByTimeAsync(MOVE_HISTORY_POLL_INTERVAL_MS);
    await waitFor(() =>
      expect(queryClient.getQueryState(gameKeys.moveHistory(GAME_ID))?.status).toBe('error'),
    );

    expect(screen.getByRole('list')).toBeVisible();
    expect(screen.getByText(sharedCopy.errors.refreshFailed)).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
