import { describe, expect, it } from 'vitest';

import { applyStrategyOverride } from '../../src/bot/strategy-override.ts';
import { STRATEGY_CONFIG } from '../../src/domain/engine/strategy-config.ts';

describe('applyStrategyOverride', () => {
  it('returns the defaults when no override is given', () => {
    expect(applyStrategyOverride({ json: undefined })).toEqual(STRATEGY_CONFIG);
  });

  it('replaces only the named thresholds', () => {
    expect(applyStrategyOverride({ json: '{"livesFloor":1,"levelUpEnabled":false}' })).toEqual({
      ...STRATEGY_CONFIG,
      livesFloor: 1,
      levelUpEnabled: false,
    });
  });

  it('rejects a misspelt key instead of silently benchmarking the defaults', () => {
    expect(() => applyStrategyOverride({ json: '{"liveFloor":1}' })).toThrow();
  });

  it('rejects a probability floor outside 0..1', () => {
    expect(() => applyStrategyOverride({ json: '{"minimumProbability":45}' })).toThrow();
  });
});
