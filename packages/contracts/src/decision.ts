export type DecisionRule =
  'survival_floor' | 'level_up' | 'best_expected_value' | 'safest_available' | 'no_viable_option';

export type Reasoning = {
  rule: DecisionRule;
  estimatedProbability: number | null;
  expectedValue: number | null;
  consideredCount: number;
};

export type Decision =
  | { kind: 'solve'; adId: string; reasoning: Reasoning }
  | { kind: 'buy'; itemId: string; reasoning: Reasoning }
  | { kind: 'stop'; reasoning: Reasoning };
