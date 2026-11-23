export type DecisionRule =
  'survival_floor' | 'level_up' | 'best_expected_value' | 'safest_available' | 'no_viable_option';

export type Reasoning = {
  rule: DecisionRule;
  estimatedProbability: number | null;
  expectedValue: number | null;
  consideredCount: number;
};

// A solve always acted on an estimate, and ad_attempts records it, so it is never null.
export type ScoredReasoning = Reasoning & { estimatedProbability: number; expectedValue: number };

export type Decision =
  | { kind: 'solve'; adId: string; reasoning: ScoredReasoning }
  | { kind: 'buy'; itemId: string; reasoning: Reasoning }
  | { kind: 'stop'; reasoning: Reasoning };
