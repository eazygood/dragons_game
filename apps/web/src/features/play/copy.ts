import type { AdVerdict, DecisionRule } from '@bigbank-dragon/contracts';

export const copy = {
  start: {
    title: 'Start playing',
    newGame: 'New game',
    starting: 'Starting…',
    resumeLabel: 'Resume a game by id',
    resume: 'Resume',
    invalidGameId: 'A game id is 1–64 letters, digits, "-" or "_".',
  },
  board: {
    verdict: {
      recommended: 'Recommended',
      viable: 'Viable',
      long_shot: 'Long shot',
      unattemptable: 'Unattemptable',
    } satisfies Record<AdVerdict, string>,
  },
  errors: {
    upstreamUnavailable: 'The game is safe, but the Mugloar server is not answering. Try again.',
    unexpected: 'Something went wrong on our side. Try again.',
    retry: 'Retry',
  },
  rules: {
    survival_floor: 'Lives are low, so buying a healing potion comes first.',
    level_up: 'Raising the dragon level makes harder ads winnable.',
    best_expected_value: 'This ad has the best expected gold of everything on the board.',
    safest_available: 'Nothing pays well, so this is the safest ad on the board.',
    no_viable_option: 'No ad or item is worth the turn right now.',
    player_choice: 'You chose this move.',
  } satisfies Record<DecisionRule, string>,
} as const;
