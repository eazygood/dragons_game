import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import '../src/zod-config.ts';

describe('zod config', () => {
  // The CSP forbids eval, and zod's default probe for it is a `new Function` call that
  // would be reported as a violation on every page load.
  it('skips the code-generating fast path', () => {
    expect(z.config().jitless).toBe(true);
  });
});
