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
