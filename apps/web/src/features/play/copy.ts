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
    title: 'Ads',
    solve: 'Solve',
    solveLabel: (message: string) => `Solve: ${message}`,
    reward: 'Reward',
    expiresIn: (turns: number) => `Expires in ${turns} turns`,
    unattemptableReason: 'The engine rates this ad as unwinnable at your dragon level.',
    decodedTag: 'Decoded',
    verdictLabel: 'Verdict',
    estimate: 'Win chance',
    expectedValue: 'Expected value',
    verdict: {
      recommended: 'Recommended',
      viable: 'Viable',
      long_shot: 'Long shot',
      unattemptable: 'Unattemptable',
    } satisfies Record<AdVerdict, string>,
  },
  shop: {
    title: 'Shop',
    buy: 'Buy',
    buyLabel: (itemName: string) => `Buy ${itemName}`,
    cost: (gold: number) => `${gold} gold`,
    needMoreGold: (missingGold: number) => `Needs ${missingGold} more gold`,
  },
  moves: {
    succeeded: 'Success.',
    failed: 'Failed.',
    adExpired: 'That ad expired before you got to it. The board has been refreshed.',
    purchaseRefused: 'The shop refused the purchase. The board has been refreshed.',
  },
  status: {
    label: 'Game status',
    score: 'Score',
    gold: 'Gold',
    lives: 'Lives',
    dragonLevel: 'Dragon level',
    turn: 'Turn',
  },
  advice: {
    title: 'Engine advice',
    solve: (message: string) => `Solve “${message}”.`,
    buy: (itemName: string) => `Buy ${itemName}.`,
    odds: (percent: string, gold: string) => `Win chance ${percent}, expected ${gold}.`,
  },
  game: {
    loading: 'Loading game…',
    loadingTurn: 'Loading the board…',
  },
  gameOver: {
    title: 'Game over',
    finalScore: (score: number) => `Final score: ${score}`,
    newGame: 'New game',
  },
  invalidGame: {
    title: 'Not a game id',
    body: 'That link does not point to a game.',
    back: 'Back to start',
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
