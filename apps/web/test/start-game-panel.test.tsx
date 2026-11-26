import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { playCopy } from '../src/features/play/play-copy.ts';
import { sharedCopy } from '../src/shared/shared-copy.ts';
import { StartGamePanel } from '../src/features/play/start/StartGamePanel.tsx';
import { jsonResponse, respondNever, respondWith, stubApi } from './fetch-stub.ts';
import { GAME_VIEW } from './fixtures.ts';
import { renderWithQuery } from './render.tsx';

describe('StartGamePanel', () => {
  it('starts a new game and hands over its id', async () => {
    stubApi({ 'POST /api/games': () => jsonResponse({ status: 201, body: GAME_VIEW }) });
    const onGameReady = vi.fn();

    renderWithQuery(<StartGamePanel onGameReady={onGameReady} onBotGameReady={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: playCopy.start.newGame }));

    await waitFor(() => expect(onGameReady).toHaveBeenCalledWith(GAME_VIEW.state.gameId));
  });

  it.each(['../x', 'cVlmaFlnRnQ=', 'a'.repeat(65)])('blocks resuming %j', async (value) => {
    renderWithQuery(<StartGamePanel onGameReady={vi.fn()} onBotGameReady={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(playCopy.start.resumeLabel), value);

    expect(screen.getByRole('button', { name: playCopy.start.resume })).toBeDisabled();
    expect(screen.getByText(playCopy.start.invalidGameId)).toBeVisible();
  });

  it('links the validation message to the input', async () => {
    renderWithQuery(<StartGamePanel onGameReady={vi.fn()} onBotGameReady={vi.fn()} />);
    const input = screen.getByLabelText(playCopy.start.resumeLabel);

    await userEvent.type(input, '../x');

    expect(input).toHaveAccessibleDescription(playCopy.start.invalidGameId);
  });

  it('resumes a well-formed id, trimmed', async () => {
    const onGameReady = vi.fn();

    renderWithQuery(<StartGamePanel onGameReady={onGameReady} onBotGameReady={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(playCopy.start.resumeLabel), '  xuRILCk8 ');
    await userEvent.click(screen.getByRole('button', { name: playCopy.start.resume }));

    expect(onGameReady).toHaveBeenCalledWith('xuRILCk8');
  });

  it('shows why a new game could not start', async () => {
    stubApi({
      'POST /api/games': () =>
        jsonResponse({
          status: 502,
          body: { error: { code: 'upstream_unavailable', message: 'down' } },
        }),
    });

    renderWithQuery(<StartGamePanel onGameReady={vi.fn()} onBotGameReady={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: playCopy.start.newGame }));

    expect(await screen.findByText(sharedCopy.errors.upstreamUnavailable)).toBeVisible();
  });

  it.each([
    { start: 'POST /api/games', button: playCopy.start.newGame },
    { start: 'POST /api/bot-games', button: playCopy.start.botPlay },
  ])('tells the player to wait when $start is rate limited', async ({ start, button }) => {
    stubApi({
      [start]: respondWith({
        status: 429,
        body: { error: { code: 'too_many_requests', message: 'slow down' } },
      }),
    });

    renderWithQuery(<StartGamePanel onGameReady={vi.fn()} onBotGameReady={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: button }));

    expect(await screen.findByRole('alert')).toHaveTextContent(sharedCopy.errors.tooManyRequests);
    expect(screen.getByRole('button', { name: button })).toBeEnabled();
  });

  it('moves focus to the start heading when the page opens', () => {
    renderWithQuery(<StartGamePanel onGameReady={vi.fn()} onBotGameReady={vi.fn()} />);

    expect(screen.getByRole('heading', { name: playCopy.start.title })).toHaveFocus();
  });

  it('starts a bot game and hands over its id', async () => {
    stubApi({ 'POST /api/bot-games': () => jsonResponse({ status: 201, body: GAME_VIEW }) });
    const onGameReady = vi.fn();
    const onBotGameReady = vi.fn();

    renderWithQuery(<StartGamePanel onGameReady={onGameReady} onBotGameReady={onBotGameReady} />);
    await userEvent.click(screen.getByRole('button', { name: playCopy.start.botPlay }));

    await waitFor(() => expect(onBotGameReady).toHaveBeenCalledWith(GAME_VIEW.state.gameId));
    expect(onGameReady).not.toHaveBeenCalled();
  });

  it('disables both start buttons while the bot game is starting', async () => {
    stubApi({ 'POST /api/bot-games': respondNever() });

    renderWithQuery(<StartGamePanel onGameReady={vi.fn()} onBotGameReady={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: playCopy.start.botPlay }));

    expect(await screen.findByRole('button', { name: sharedCopy.botStarting })).toBeDisabled();
    expect(screen.getByRole('button', { name: playCopy.start.newGame })).toBeDisabled();
  });

  it('disables both start buttons while a new game is starting', async () => {
    stubApi({ 'POST /api/games': respondNever() });

    renderWithQuery(<StartGamePanel onGameReady={vi.fn()} onBotGameReady={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: playCopy.start.newGame }));

    expect(await screen.findByRole('button', { name: playCopy.start.starting })).toBeDisabled();
    expect(screen.getByRole('button', { name: playCopy.start.botPlay })).toBeDisabled();
  });

  it('sends one bot game request when the button is clicked twice quickly', async () => {
    const fetchStub = stubApi({ 'POST /api/bot-games': respondNever() });

    renderWithQuery(<StartGamePanel onGameReady={vi.fn()} onBotGameReady={vi.fn()} />);
    await userEvent.dblClick(screen.getByRole('button', { name: playCopy.start.botPlay }));

    expect(await screen.findByRole('button', { name: sharedCopy.botStarting })).toBeDisabled();
    expect(fetchStub.callCountOf('POST /api/bot-games')).toBe(1);
  });

  // Navigation commits after the mutation settles; the buttons must not re-enable in that gap.
  it('keeps both start buttons disabled after the bot game started', async () => {
    stubApi({ 'POST /api/bot-games': () => jsonResponse({ status: 201, body: GAME_VIEW }) });
    const onBotGameReady = vi.fn();

    renderWithQuery(<StartGamePanel onGameReady={vi.fn()} onBotGameReady={onBotGameReady} />);
    await userEvent.click(screen.getByRole('button', { name: playCopy.start.botPlay }));
    await waitFor(() => expect(onBotGameReady).toHaveBeenCalledTimes(1));

    expect(screen.getByRole('button', { name: playCopy.start.botPlay })).toBeDisabled();
    expect(screen.getByRole('button', { name: playCopy.start.newGame })).toBeDisabled();
  });

  it('shows the error when the bot cannot start', async () => {
    stubApi({
      'POST /api/bot-games': () =>
        jsonResponse({
          status: 502,
          body: { error: { code: 'upstream_unavailable', message: 'down' } },
        }),
    });

    renderWithQuery(<StartGamePanel onGameReady={vi.fn()} onBotGameReady={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: playCopy.start.botPlay }));

    expect(await screen.findByText(sharedCopy.errors.upstreamUnavailable)).toBeVisible();
    expect(screen.getByRole('button', { name: playCopy.start.botPlay })).toBeEnabled();
  });

  it('drops the earlier failure once the other start button is used', async () => {
    stubApi({
      'POST /api/games': () =>
        jsonResponse({ status: 500, body: { error: { code: 'internal', message: 'boom' } } }),
      'POST /api/bot-games': respondNever(),
    });

    renderWithQuery(<StartGamePanel onGameReady={vi.fn()} onBotGameReady={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: playCopy.start.newGame }));
    expect(await screen.findByText(sharedCopy.errors.unexpected)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: playCopy.start.botPlay }));

    await waitFor(() => expect(screen.queryByText(sharedCopy.errors.unexpected)).toBeNull());
  });
});
