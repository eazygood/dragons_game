import type { Move } from '@bigbank-dragon/contracts';
import { describe, expect, it } from 'vitest';

import { keyedMoves } from '../src/features/watch/keyed-moves.ts';
import { BUY_MOVE, SOLVE_MOVE } from './fixtures.ts';

const keysOf = ({ moves }: { moves: Move[] }) => keyedMoves({ moves }).map(({ key }) => key);

describe('keyedMoves', () => {
  it('gives moves that share a kind and a turn different keys', () => {
    const keys = keysOf({ moves: [BUY_MOVE, BUY_MOVE, SOLVE_MOVE] });

    expect(new Set(keys).size).toBe(keys.length);
  });

  // The list is newest first, so a new move is prepended; renumbering the rest would remount every row.
  it('keeps the key of an existing move when a newer move is added in front of it', () => {
    const before = keysOf({ moves: [BUY_MOVE, BUY_MOVE] });
    const after = keysOf({ moves: [SOLVE_MOVE, BUY_MOVE, BUY_MOVE] });

    expect(after.slice(1)).toEqual(before);
  });

  it('returns the moves unchanged and in the same order', () => {
    const moves = [SOLVE_MOVE, BUY_MOVE];

    expect(keyedMoves({ moves }).map(({ move }) => move)).toEqual(moves);
  });
});
