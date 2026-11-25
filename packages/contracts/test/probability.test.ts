import { describe, expect, it } from 'vitest';

import { PROBABILITY_LABELS } from '../src/index.ts';

describe('probability labels', () => {
  it('lists the eleven observed labels, best first', () => {
    expect(PROBABILITY_LABELS).toHaveLength(11);
    expect(PROBABILITY_LABELS[0]).toBe('Sure thing');
    expect(PROBABILITY_LABELS.at(-1)).toBe('Impossible');
    expect(PROBABILITY_LABELS).toContain('Hmmm....');
  });
});
