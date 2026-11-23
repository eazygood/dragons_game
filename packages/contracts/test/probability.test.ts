import { describe, expect, it } from 'vitest';

import { IMPOSSIBLE_LABEL, PROBABILITY_LABELS, PROBABILITY_PRIOR } from '../src/index.ts';

describe('probability labels', () => {
  it('lists the eleven observed labels, best first', () => {
    expect(PROBABILITY_LABELS).toHaveLength(11);
    expect(PROBABILITY_LABELS[0]).toBe('Sure thing');
    expect(PROBABILITY_LABELS.at(-1)).toBe('Impossible');
    expect(PROBABILITY_LABELS).toContain('Hmmm....');
  });

  it('gives every label a prior and ranks them monotonically', () => {
    const priors = PROBABILITY_LABELS.map((label) => PROBABILITY_PRIOR[label]);

    expect(priors).toHaveLength(11);
    expect([...priors].sort((a, b) => b - a)).toEqual(priors);
    expect(PROBABILITY_PRIOR[IMPOSSIBLE_LABEL]).toBe(0);
  });
});
