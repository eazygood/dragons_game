import { describe, expect, it } from 'vitest';

import { createBotGameRegistry } from '../../src/mediators/bot-mediator.ts';
import { isPending } from '../support/is-pending.ts';

const LIMIT = 2;

describe('bot game registry', () => {
  it('hands out slots up to the limit', () => {
    const registry = createBotGameRegistry({ limit: LIMIT });

    expect(registry.reserve()).not.toBeNull();
    expect(registry.reserve()).not.toBeNull();
    expect(registry.reserve()).toBeNull();
  });

  it('frees a slot that was released before its game started', () => {
    const registry = createBotGameRegistry({ limit: 1 });

    registry.reserve()?.release();

    expect(registry.reserve()).not.toBeNull();
  });

  it('keeps a slot taken until its game settles', async () => {
    const registry = createBotGameRegistry({ limit: 1 });
    const { promise: game, resolve } = Promise.withResolvers<void>();

    registry.reserve()?.hold({ game });

    expect(registry.reserve()).toBeNull();

    resolve();
    await game;

    expect(registry.reserve()).not.toBeNull();
  });

  it('frees the slot of a game that rejects', async () => {
    const registry = createBotGameRegistry({ limit: 1 });
    const game = Promise.reject(new Error('boom'));

    registry.reserve()?.hold({ game });
    await game.catch(() => undefined);

    expect(registry.reserve()).not.toBeNull();
  });

  it('does not free a second slot when released after hold', async () => {
    const registry = createBotGameRegistry({ limit: 1 });
    const { promise: game, resolve } = Promise.withResolvers<void>();
    const slot = registry.reserve();

    slot?.hold({ game });
    slot?.release();

    expect(registry.reserve()).not.toBeNull();

    resolve();
    await game;
  });

  it('aborts every game on shutdown and waits for them to settle', async () => {
    const registry = createBotGameRegistry({ limit: LIMIT });
    const { promise: game, resolve: finishGame } = Promise.withResolvers<void>();
    const held = registry.reserve();
    const starting = registry.reserve();

    held?.hold({ game });

    const shutdown = registry.shutdown();

    expect(held?.signal.aborted).toBe(true);
    expect(starting?.signal.aborted).toBe(true);
    expect(await isPending({ promise: shutdown })).toBe(true);

    finishGame();
    starting?.release();

    await expect(shutdown).resolves.toBeUndefined();
  });

  it('refuses new games once shutting down', async () => {
    const registry = createBotGameRegistry({ limit: LIMIT });

    await registry.shutdown();

    expect(registry.reserve()).toBeNull();
  });

  it('tells a closing registry apart from a full one', async () => {
    const registry = createBotGameRegistry({ limit: 1 });

    const held = registry.reserve();

    expect(registry.isClosing()).toBe(false);

    const shutdown = registry.shutdown();

    expect(registry.isClosing()).toBe(true);

    held?.release();
    await shutdown;
  });
});
