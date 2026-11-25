import { z } from 'zod';

// Prior ranking only: what the engine believes before it has data.
export const PROBABILITY_LABELS = [
  'Sure thing',
  'Piece of cake',
  'Walk in the park',
  'Quite likely',
  'Hmmm....',
  'Gamble',
  'Risky',
  'Rather detrimental',
  'Playing with fire',
  'Suicide mission',
  'Impossible',
] as const;

export type ProbabilityLabel = (typeof PROBABILITY_LABELS)[number];

export const ProbabilityLabelSchema = z.enum(PROBABILITY_LABELS);

export const IMPOSSIBLE_LABEL = 'Impossible' satisfies ProbabilityLabel;

export const PROBABILITY_PRIOR: Readonly<Record<ProbabilityLabel, number>> = {
  'Sure thing': 0.95,
  'Piece of cake': 0.9,
  'Walk in the park': 0.85,
  'Quite likely': 0.75,
  'Hmmm....': 0.6,
  Gamble: 0.5,
  Risky: 0.4,
  'Rather detrimental': 0.3,
  'Playing with fire': 0.2,
  'Suicide mission': 0.1,
  Impossible: 0,
};
