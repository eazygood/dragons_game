import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { useMoveActions } from '../src/features/play/move-actions/use-move-actions.ts';
import { respondNever, stubApi } from './fetch-stub.ts';

const SOLVE_ROUTE = 'POST /api/games/g1/ads/sure1/solve';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('useMoveActions', () => {
  // A turn is burnt per accepted request, so a move that arrives while one is in flight
  // must be dropped, whatever the board did or did not disable.
  it('ignores a move requested while another is still in flight', async () => {
    const api = stubApi({ [SOLVE_ROUTE]: respondNever() });
    const { result } = renderHook(() => useMoveActions({ gameId: 'g1' }), { wrapper });

    // mutate starts its request after a microtask, so each call is flushed inside act.
    const requestSolve = () =>
      act(async () => {
        result.current.moveActions.solve('sure1');
        await Promise.resolve();
      });

    await requestSolve();
    await waitFor(() => expect(result.current.moveActions.isPending).toBe(true));
    await requestSolve();

    expect(api.callCountOf(SOLVE_ROUTE)).toBe(1);
  });
});
