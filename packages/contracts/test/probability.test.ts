import { describe, expect, it } from 'vitest';

import { IMPOSSIBLE_LABEL, PROBABILITY_LABELS } from '../src/index.ts';

describe('probability labels', () => {
  // The engine's prior is read off the index, so a duplicate or a misplaced end would skew it.
  it('ranks each label once, best first and the impossible one last', () => {
    expect(new Set(PROBABILITY_LABELS).size).toBe(PROBABILITY_LABELS.length);
    expect(PROBABILITY_LABELS[0]).toBe('Sure thing');
    expect(PROBABILITY_LABELS.at(-1)).toBe(IMPOSSIBLE_LABEL);
  });
});
