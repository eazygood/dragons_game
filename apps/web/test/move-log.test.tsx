import type { DecisionRule, Move } from '@bigbank-dragon/contracts';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { sharedCopy } from '../src/shared/shared-copy.ts';
import { WatchScreen } from '../src/features/watch/WatchScreen.tsx';
import { respondInSequence, respondOk, respondWith, stubApi } from './fetch-stub.ts';
import {
  BUY_MOVE,
  GAME_ROUTE,
  GAME_VIEW,
  MOVES_ROUTE,
  SHOW_MOVES,
  SOLVE_MOVE,
} from './fixtures.ts';
import { renderInRouter } from './render.tsx';

const LEGACY_SOLVE_MOVE: Move = { ...SOLVE_MOVE, turn: 2, success: false, rule: null };
const LEGACY_BUY_MOVE: Move = { ...BUY_MOVE, turn: 1, success: true, itemName: null, rule: null };

const showMoves = () => userEvent.click(screen.getByRole('checkbox', { name: SHOW_MOVES }));

const renderWatchedGame = async ({ moves }: { moves: Move[] }) => {
  const api = stubApi({
    [GAME_ROUTE]: respondOk({ body: GAME_VIEW }),
    [MOVES_ROUTE]: respondOk({ body: moves }),
  });

  renderInRouter(<WatchScreen gameId="g1" />);
  await screen.findByRole('checkbox', { name: SHOW_MOVES });

  return api;
};

const listedMoves = async () => within(await screen.findByRole('list')).getAllByRole('listitem');

const textOf = ({ items }: { items: HTMLElement[] }) => items.map((item) => item.textContent);

describe('the bot move log', () => {
  it('hides the moves and does not fetch them by default', async () => {
    const api = await renderWatchedGame({ moves: [SOLVE_MOVE] });

    expect(screen.getByRole('checkbox', { name: SHOW_MOVES })).not.toBeChecked();
    expect(screen.queryByRole('list')).toBeNull();
    expect(api.callCountOf(MOVES_ROUTE)).toBe(0);
  });

  it('fetches and lists moves newest first once Show moves is ticked', async () => {
    const api = await renderWatchedGame({ moves: [SOLVE_MOVE, BUY_MOVE] });

    await showMoves();
    const items = await listedMoves();

    expect(api.callCountOf(MOVES_ROUTE)).toBe(1);
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(/^Turn 4/);
    expect(items[1]).toHaveTextContent(/^Turn 3/);
  });

  it('renders a solve with its reason and a purchase with its item', async () => {
    await renderWatchedGame({ moves: [SOLVE_MOVE, BUY_MOVE] });

    await showMoves();
    const items = await listedMoves();

    expect(textOf({ items })).toEqual([
      'Turn 4 · Solved a “Sure thing” ad for 30 gold · best value, est. 95%, EV +25 gold · ✓',
      'Turn 3 · Attempted to buy Healing potion · keep lives safe · ✗',
    ]);
    expect(screen.getByRole('img', { name: 'succeeded' })).toHaveTextContent('✓');
    expect(screen.getByRole('img', { name: 'failed' })).toHaveTextContent('✗');
  });

  it('renders legacy moves without a reason', async () => {
    await renderWatchedGame({ moves: [LEGACY_SOLVE_MOVE, LEGACY_BUY_MOVE] });

    await showMoves();
    const items = await listedMoves();

    expect(textOf({ items })).toEqual([
      'Turn 2 · Attempted a “Sure thing” ad for 30 gold · ✗',
      'Turn 1 · Bought an item · ✓',
    ]);
  });

  it.each([
    {
      outcome: 'a solve that worked',
      move: { ...SOLVE_MOVE, rule: null },
      line: 'Turn 4 · Solved a “Sure thing” ad for 30 gold · ✓',
    },
    {
      outcome: 'a solve that failed',
      move: { ...SOLVE_MOVE, success: false, probability: 'Suicide mission', rule: null },
      line: 'Turn 4 · Attempted a “Suicide mission” ad for 30 gold · ✗',
    },
    {
      outcome: 'a purchase that worked',
      move: { ...BUY_MOVE, success: true, rule: null },
      line: 'Turn 3 · Bought Healing potion · ✓',
    },
    {
      outcome: 'a purchase that failed',
      move: { ...BUY_MOVE, success: false, rule: null },
      line: 'Turn 3 · Attempted to buy Healing potion · ✗',
    },
    {
      outcome: 'an unnamed purchase that failed',
      move: { ...BUY_MOVE, success: false, itemName: null, rule: null },
      line: 'Turn 3 · Attempted to buy an item · ✗',
    },
  ] satisfies { outcome: string; move: Move; line: string }[])(
    'words $outcome so the verb matches the mark',
    async ({ move, line }) => {
      await renderWatchedGame({ moves: [move] });

      await showMoves();

      expect(textOf({ items: await listedMoves() })).toEqual([line]);
    },
  );

  it('words every decision rule', async () => {
    const wordings: Record<DecisionRule, string> = {
      survival_floor: 'keep lives safe',
      level_up: 'level up',
      best_expected_value: 'best value',
      safest_available: 'safest ad left',
      no_viable_option: 'nothing worth doing',
      player_choice: "player's choice",
    };
    const rules = Object.keys(wordings) as DecisionRule[];

    await renderWatchedGame({
      moves: rules.map((rule) => ({ ...BUY_MOVE, success: true, rule })),
    });
    await showMoves();
    const items = await listedMoves();

    expect(textOf({ items })).toEqual(
      rules.map((rule) => `Turn 3 · Bought Healing potion · ${wordings[rule]} · ✓`),
    );
  });

  it('says so when the bot has not moved yet', async () => {
    await renderWatchedGame({ moves: [] });

    await showMoves();

    expect(await screen.findByText('No moves yet.')).toBeVisible();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('offers a retry when the moves cannot be loaded', async () => {
    stubApi({
      [GAME_ROUTE]: respondOk({ body: GAME_VIEW }),
      [MOVES_ROUTE]: respondInSequence({
        responders: [
          respondWith({
            status: 502,
            body: { error: { code: 'upstream_unavailable', message: 'down' } },
          }),
          respondOk({ body: [SOLVE_MOVE] }),
        ],
      }),
    });

    renderInRouter(<WatchScreen gameId="g1" />);
    await userEvent.click(await screen.findByRole('checkbox', { name: SHOW_MOVES }));
    await userEvent.click(await screen.findByRole('button', { name: sharedCopy.errors.retry }));

    expect(await listedMoves()).toHaveLength(1);
  });

  it('lists two moves of the same kind and turn without a duplicate key warning', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await renderWatchedGame({ moves: [BUY_MOVE, BUY_MOVE] });
    await showMoves();

    expect(await listedMoves()).toHaveLength(2);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
