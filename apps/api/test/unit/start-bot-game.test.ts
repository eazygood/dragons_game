import type { Knex } from 'knex';
import { describe, expect, it } from 'vitest';

import { SILENT_LOGGER } from '../../src/managers/bot-manager.ts';
import { createBotGameRegistry, startBotGame } from '../../src/mediators/bot-mediator.ts';

// A refused reservation is answered before the database or the upstream is touched, so
// the handle is never used.
const unusedDb = {} as Knex;

describe('startBotGame refusals', () => {
  it('answers 503 while the registry is shutting down, a state that does not recover', async () => {
    const registry = createBotGameRegistry({ limit: 1 });

    await registry.shutdown();

    await expect(
      startBotGame({ db: unusedDb, logger: SILENT_LOGGER, registry }),
    ).rejects.toMatchObject({ code: 'service_unavailable', statusCode: 503 });
  });

  it('answers 429 when every slot is taken, a state that recovers', async () => {
    const registry = createBotGameRegistry({ limit: 1 });

    registry.reserve();

    await expect(
      startBotGame({ db: unusedDb, logger: SILENT_LOGGER, registry }),
    ).rejects.toMatchObject({ code: 'too_many_requests', statusCode: 429 });
  });
});
