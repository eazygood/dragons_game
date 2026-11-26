import { TARGET_SCORE } from '@bigbank-dragon/contracts';
import type { DecisionRule, ProbabilityLabel } from '@bigbank-dragon/contracts';

export const watchCopy = {
  title: 'Watching a game',
  inProgress: 'In progress…',
  reachedTarget: (score: number) => `Reached ${TARGET_SCORE} ✓ — final score ${score}`,
  finishedBelowTarget: (score: number) => `Finished at ${score}`,
  target: `Target ${TARGET_SCORE}`,
  playYourself: 'Play a game yourself',
  runAgain: 'Run the bot again',
  showMoves: 'Show moves',
  loadingMoves: 'Loading moves…',
  noMovesYet: 'No moves yet.',
  moveListLabel: 'Moves',
  move: {
    separator: ' · ',
    turn: ({ turn }: { turn: number }) => `Turn ${turn}`,
    solved: ({ adRating, reward }: { adRating: ProbabilityLabel; reward: number }) =>
      `Solved a “${adRating}” ad for ${reward} gold`,
    solveAttempted: ({ adRating, reward }: { adRating: ProbabilityLabel; reward: number }) =>
      `Attempted a “${adRating}” ad for ${reward} gold`,
    solveReason: ({ rule, percent, gold }: { rule: string; percent: string; gold: string }) =>
      `${rule}, est. ${percent}, EV ${gold}`,
    bought: ({ itemName }: { itemName: string }) => `Bought ${itemName}`,
    buyAttempted: ({ itemName }: { itemName: string }) => `Attempted to buy ${itemName}`,
    boughtUnnamedItem: 'Bought an item',
    buyAttemptedUnnamedItem: 'Attempted to buy an item',
    succeeded: { mark: '✓', label: 'succeeded' },
    failed: { mark: '✗', label: 'failed' },
  },
  rules: {
    survival_floor: 'keep lives safe',
    level_up: 'level up',
    best_expected_value: 'best value',
    safest_available: 'safest ad left',
    no_viable_option: 'nothing worth doing',
    player_choice: "player's choice",
  } satisfies Record<DecisionRule, string>,
} as const;
