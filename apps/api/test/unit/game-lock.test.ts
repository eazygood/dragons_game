import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withGameLock } from '../../src/managers/game-manager.ts';

const nextMacrotask = () => new Promise((resolve) => setImmediate(resolve));

describe('withGameLock', () => {
  let events: string[];

  beforeEach(() => {
    events = [];
  });

  const recording = ({ name, gate }: { name: string; gate?: Promise<void> }) => {
    return async () => {
      events.push(`${name} started`);
      await gate;
      events.push(`${name} finished`);

      return name;
    };
  };

  it('runs a second move of the same game only after the first has finished', async () => {
    const gate = Promise.withResolvers<void>();
    const first = withGameLock({
      gameId: 'serial',
      task: recording({ name: 'first', gate: gate.promise }),
    });
    const second = withGameLock({ gameId: 'serial', task: recording({ name: 'second' }) });

    await nextMacrotask();
    expect(events).toEqual(['first started']);

    gate.resolve();
    await Promise.all([first, second]);

    expect(events).toEqual([
      'first started',
      'first finished',
      'second started',
      'second finished',
    ]);
  });

  it('keeps arrival order for a queue of moves on one game', async () => {
    const gate = Promise.withResolvers<void>();
    const moves = ['first', 'second', 'third'].map((name) =>
      withGameLock({
        gameId: 'queue',
        task: recording({ name, gate: name === 'first' ? gate.promise : undefined }),
      }),
    );

    gate.resolve();

    await expect(Promise.all(moves)).resolves.toEqual(['first', 'second', 'third']);
    expect(events).toEqual([
      'first started',
      'first finished',
      'second started',
      'second finished',
      'third started',
      'third finished',
    ]);
  });

  it('does not make one game wait for another', async () => {
    const gate = Promise.withResolvers<void>();
    const slow = withGameLock({
      gameId: 'slow-game',
      task: recording({ name: 'slow', gate: gate.promise }),
    });
    const other = withGameLock({ gameId: 'other-game', task: recording({ name: 'other' }) });

    await expect(other).resolves.toBe('other');
    expect(events).toEqual(['slow started', 'other started', 'other finished']);

    gate.resolve();
    await slow;
  });

  describe('when a move throws', () => {
    const failing = () => Promise.reject(new Error('upstream down'));

    it('rejects its own caller and lets the next move of that game run', async () => {
      const failed = withGameLock({ gameId: 'failing', task: failing });
      const next = withGameLock({ gameId: 'failing', task: recording({ name: 'next' }) });

      await expect(failed).rejects.toThrow('upstream down');
      await expect(next).resolves.toBe('next');
    });

    it('leaves the game unlocked afterwards', async () => {
      await expect(withGameLock({ gameId: 'recovers', task: failing })).rejects.toThrow();

      await expect(
        withGameLock({ gameId: 'recovers', task: recording({ name: 'later' }) }),
      ).resolves.toBe('later');
    });

    describe('and nobody awaits the internal queue', () => {
      const unhandled = vi.fn();

      beforeEach(() => {
        unhandled.mockClear();
        process.on('unhandledRejection', unhandled);
      });

      afterEach(() => {
        process.off('unhandledRejection', unhandled);
      });

      it('raises no unhandled rejection from the queue it keeps for ordering', async () => {
        await expect(withGameLock({ gameId: 'quiet', task: failing })).rejects.toThrow();
        await nextMacrotask();

        expect(unhandled).not.toHaveBeenCalled();
      });
    });
  });
});
