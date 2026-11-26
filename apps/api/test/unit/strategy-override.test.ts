import { describe, expect, it } from 'vitest';

import { applyStrategyOverride } from '../../src/cli/strategy-override.ts';
import { STRATEGY_CONFIG } from '../../src/domain/engine/strategy-config.ts';

describe('applyStrategyOverride', () => {
  it('returns the defaults when no override is given', () => {
    expect(applyStrategyOverride({ json: undefined })).toEqual(STRATEGY_CONFIG);
  });

  it('replaces only the named thresholds', () => {
    const probabilityPrior = { ...STRATEGY_CONFIG.probabilityPrior, 'Sure thing': 0.9 };
    const json = JSON.stringify({ livesFloor: 1, probabilityPrior });

    expect(applyStrategyOverride({ json })).toEqual({
      ...STRATEGY_CONFIG,
      livesFloor: 1,
      probabilityPrior,
    });
  });

  it('rejects a misspelt key instead of silently benchmarking the defaults', () => {
    expect(() => applyStrategyOverride({ json: '{"liveFloor":1}' })).toThrow();
  });

  it('rejects a prior that leaves a label out, so no label silently falls back to zero', () => {
    expect(() =>
      applyStrategyOverride({ json: '{"probabilityPrior":{"Sure thing":0.9}}' }),
    ).toThrow();
  });

  it('rejects a probability floor outside 0..1', () => {
    expect(() => applyStrategyOverride({ json: '{"minimumProbability":45}' })).toThrow();
  });
});
