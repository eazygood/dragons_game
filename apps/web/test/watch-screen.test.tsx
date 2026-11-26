import { TARGET_SCORE } from '@bigbank-dragon/contracts';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { gameKeys } from '../src/api/game-queries.ts';
import { WATCH_POLL_INTERVAL_MS } from '../src/api/poll-intervals.ts';
import { sharedCopy } from '../src/shared/shared-copy.ts';
import { watchCopy } from '../src/features/watch/watch-copy.ts';
import { watchOutcome } from '../src/features/watch/watch-outcome.ts';
import { WatchScreen } from '../src/features/watch/WatchScreen.tsx';
import { respondInSequence, respondOk, respondWith, stubApi } from './fetch-stub.ts';
import {
  ABOVE_TARGET,
  GAME_ID,
  GAME_ROUTE,
  INTERVALS_AFTER_FINISH,
  buildGameView,
} from './fixtures.ts';
import { renderInRouter } from './render.tsx';

const BELOW_TARGET = 640;

const LIVE_GAME = {
  state: { gameId: 'g1', lives: 2, gold: 75, dragonLevel: 1, turn: 18, score: 340 },
  status: 'active' as const,
};

const expectStatusField = ({ label, value }: { label: string; value: number }) =>
  expect(screen.getByText(label).parentElement).toHaveTextContent(`${label}${value}`);

afterEach(() => {
  vi.useRealTimers();
});

describe('WatchScreen', () => {
  it('shows the live numbers and In progress while active', async () => {
    stubApi({ [GAME_ROUTE]: respondOk({ body: LIVE_GAME }) });

    renderInRouter(<WatchScreen gameId="g1" />);

    expect(await screen.findByText(watchCopy.inProgress)).toBeVisible();
    expectStatusField({ label: sharedCopy.status.score, value: 340 });
    expectStatusField({ label: sharedCopy.status.gold, value: 75 });
    expectStatusField({ label: sharedCopy.status.lives, value: 2 });
    expectStatusField({ label: sharedCopy.status.dragonLevel, value: 1 });
    expectStatusField({ label: sharedCopy.status.turn, value: 18 });
    expect(screen.getByText(watchCopy.target)).toBeVisible();
    expect(screen.queryByRole('button', { name: watchCopy.runAgain })).toBeNull();
  });

  it('says the target was reached when an abandoned game ended above it', async () => {
    const reached = buildGameView({ status: 'abandoned', score: ABOVE_TARGET });

    stubApi({ [GAME_ROUTE]: respondOk({ body: reached }) });

    renderInRouter(<WatchScreen gameId="g1" />);

    expect(await screen.findByText(watchCopy.reachedTarget(ABOVE_TARGET))).toBeVisible();
    expect(screen.queryByText(watchCopy.inProgress)).toBeNull();
    expect(screen.getByRole('link', { name: watchCopy.playYourself })).toHaveAttribute(
      'href',
      '/play',
    );
    expect(screen.getByRole('button', { name: watchCopy.runAgain })).toBeEnabled();
  });

  it('says where a game finished below the target', async () => {
    const lost = buildGameView({ status: 'game_over', score: BELOW_TARGET });

    stubApi({ [GAME_ROUTE]: respondOk({ body: lost }) });

    renderInRouter(<WatchScreen gameId="g1" />);

    expect(await screen.findByText(watchCopy.finishedBelowTarget(BELOW_TARGET))).toBeVisible();
    expect(screen.queryByText(watchCopy.inProgress)).toBeNull();
  });

  it('polls while active and stops asking once the game has finished', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const finished = buildGameView({ status: 'abandoned', score: ABOVE_TARGET });
    const api = stubApi({
      [GAME_ROUTE]: respondInSequence({
        responders: [respondOk({ body: LIVE_GAME }), respondOk({ body: finished })],
      }),
    });

    renderInRouter(<WatchScreen gameId="g1" />);
    await screen.findByText(watchCopy.inProgress);
    await vi.advanceTimersByTimeAsync(WATCH_POLL_INTERVAL_MS);
    await screen.findByText(watchCopy.reachedTarget(ABOVE_TARGET));
    const callsWhenFinished = api.callCountOf(GAME_ROUTE);

    await vi.advanceTimersByTimeAsync(WATCH_POLL_INTERVAL_MS * INTERVALS_AFTER_FINISH);

    expect(callsWhenFinished).toBe(2);
    expect(api.callCountOf(GAME_ROUTE)).toBe(callsWhenFinished);
  });

  // A manual game opened at /watch must not claim to be the bot's: GameView carries no strategy.
  it("titles the page neutrally, without calling the game the bot's", async () => {
    stubApi({ [GAME_ROUTE]: respondOk({ body: LIVE_GAME }) });

    renderInRouter(<WatchScreen gameId="g1" />);

    expect(await screen.findByRole('heading', { name: watchCopy.title })).toBeVisible();
  });

  it('keeps the live numbers and says the refresh failed when a later poll fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stubApi({
      [GAME_ROUTE]: respondInSequence({
        responders: [
          respondOk({ body: LIVE_GAME }),
          respondWith({
            status: 502,
            body: { error: { code: 'upstream_unavailable', message: 'down' } },
          }),
          respondOk({ body: LIVE_GAME }),
        ],
      }),
    });

    const { queryClient } = renderInRouter(<WatchScreen gameId={GAME_ID} />);

    await screen.findByText(watchCopy.inProgress);
    expect(screen.queryByText(sharedCopy.errors.refreshFailed)).toBeNull();

    await vi.advanceTimersByTimeAsync(WATCH_POLL_INTERVAL_MS);
    await waitFor(() =>
      expect(queryClient.getQueryState(gameKeys.game(GAME_ID))?.status).toBe('error'),
    );

    expectStatusField({ label: sharedCopy.status.score, value: 340 });
    expect(screen.getByText(sharedCopy.errors.refreshFailed)).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();

    await vi.advanceTimersByTimeAsync(WATCH_POLL_INTERVAL_MS);

    await waitFor(() => expect(screen.queryByText(sharedCopy.errors.refreshFailed)).toBeNull());
  });

  it('moves focus to the page heading once the game has loaded', async () => {
    stubApi({ [GAME_ROUTE]: respondOk({ body: LIVE_GAME }) });

    renderInRouter(<WatchScreen gameId="g1" />);

    expect(await screen.findByRole('heading', { name: watchCopy.title })).toHaveFocus();
  });

  it('shows no such game for an unknown id', async () => {
    stubApi({
      [GAME_ROUTE]: respondWith({
        status: 404,
        body: { error: { code: 'not_found', message: 'none' } },
      }),
    });

    renderInRouter(<WatchScreen gameId="g1" />);

    expect(
      await screen.findByRole('heading', { name: sharedCopy.unavailableGame.not_found.title }),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: sharedCopy.errors.retry })).toBeNull();
  });

  it('offers a retry when the game cannot be loaded', async () => {
    stubApi({
      [GAME_ROUTE]: respondInSequence({
        responders: [
          respondWith({
            status: 502,
            body: { error: { code: 'upstream_unavailable', message: 'down' } },
          }),
          respondOk({ body: LIVE_GAME }),
        ],
      }),
    });

    renderInRouter(<WatchScreen gameId="g1" />);
    await userEvent.click(await screen.findByRole('button', { name: sharedCopy.errors.retry }));

    expect(await screen.findByText(watchCopy.inProgress)).toBeVisible();
  });
});

describe('watchOutcome', () => {
  it.each([
    { status: 'active', score: 5000, expected: 'in_progress' },
    { status: 'abandoned', score: TARGET_SCORE, expected: 'reached_target' },
    { status: 'game_over', score: TARGET_SCORE, expected: 'reached_target' },
    { status: 'abandoned', score: TARGET_SCORE - 1, expected: 'finished_below_target' },
    { status: 'game_over', score: 0, expected: 'finished_below_target' },
  ] as const)('is $expected for $status at $score', ({ status, score, expected }) => {
    expect(watchOutcome({ game: buildGameView({ status, score }) })).toBe(expected);
  });
});
