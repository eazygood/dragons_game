import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { copy } from '../src/features/play/copy.ts';
import { StartGamePanel } from '../src/features/play/start/StartGamePanel.tsx';
import { jsonResponse, stubApi } from './fetch-stub.ts';
import { GAME_VIEW } from './fixtures.ts';
import { renderWithQuery } from './render.tsx';

describe('StartGamePanel', () => {
  it('starts a new game and hands over its id', async () => {
    stubApi({ 'POST /api/games': () => jsonResponse({ status: 201, body: GAME_VIEW }) });
    const onGameReady = vi.fn();

    renderWithQuery(<StartGamePanel onGameReady={onGameReady} />);
    await userEvent.click(screen.getByRole('button', { name: copy.start.newGame }));

    await waitFor(() => expect(onGameReady).toHaveBeenCalledWith(GAME_VIEW.state.gameId));
  });

  // Review Focus #4 (client half)
  it.each(['../x', 'cVlmaFlnRnQ=', 'a'.repeat(65)])('blocks resuming %j', async (value) => {
    renderWithQuery(<StartGamePanel onGameReady={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(copy.start.resumeLabel), value);

    expect(screen.getByRole('button', { name: copy.start.resume })).toBeDisabled();
    expect(screen.getByText(copy.start.invalidGameId)).toBeVisible();
  });

  it('links the validation message to the input', async () => {
    renderWithQuery(<StartGamePanel onGameReady={vi.fn()} />);
    const input = screen.getByLabelText(copy.start.resumeLabel);

    await userEvent.type(input, '../x');

    expect(input).toHaveAccessibleDescription(copy.start.invalidGameId);
  });

  it('resumes a well-formed id, trimmed', async () => {
    const onGameReady = vi.fn();

    renderWithQuery(<StartGamePanel onGameReady={onGameReady} />);
    await userEvent.type(screen.getByLabelText(copy.start.resumeLabel), '  xuRILCk8 ');
    await userEvent.click(screen.getByRole('button', { name: copy.start.resume }));

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

    renderWithQuery(<StartGamePanel onGameReady={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: copy.start.newGame }));

    expect(await screen.findByText(copy.errors.upstreamUnavailable)).toBeVisible();
  });
});
