import { IDENTIFIER_MAX_LENGTH, TARGET_SCORE } from '@dragons-game/contracts';
import type { AdVerdict, DecisionRule } from '@dragons-game/contracts';

const SINGLE_TURN = 1;

export const playCopy = {
  start: {
    title: 'Start playing',
    newGame: 'New game',
    starting: 'Starting…',
    botPlay: 'Let the bot play',
    resumeLabel: 'Resume a game by id',
    resume: 'Resume',
    invalidGameId: `A game id is 1–${IDENTIFIER_MAX_LENGTH} letters, digits, "-" or "_".`,
  },
  board: {
    title: 'Ads',
    empty: 'No ads on the board right now.',
    solve: 'Solve',
    solveLabel: (message: string) => `Solve: ${message}`,
    reward: 'Reward',
    probabilityLabel: 'Ad rating',
    expiresIn: (turns: number) => `Expires in ${turns} ${turns === SINGLE_TURN ? 'turn' : 'turns'}`,
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
    empty: 'The shop has nothing for sale.',
    buy: 'Buy',
    buyLabel: (itemName: string) => `Buy ${itemName}`,
    cost: (gold: number) => `${gold} gold`,
    needMoreGold: (missingGold: number) => `Needs ${missingGold} more gold`,
  },
  moves: {
    label: 'Move result',
    succeeded: 'Success.',
    failed: 'Failed.',
    adExpired: 'That ad expired before you got to it. The board has been refreshed.',
    purchaseRefused: 'The shop refused the purchase. The board has been refreshed.',
  },
  advice: {
    title: 'Engine advice',
    solve: (message: string) => `Solve “${message}”.`,
    buy: (itemName: string) => `Buy ${itemName}.`,
    odds: ({ percent, gold }: { percent: string; gold: string }) =>
      `Win chance ${percent}, expected ${gold}.`,
  },
  game: {
    title: 'Your game',
    loadingTurn: 'Loading the board…',
  },
  gameOver: {
    title: 'Game over',
    finalScore: (score: number) => `Final score: ${score}`,
  },
  rules: {
    survival_floor:
      'Lives end the game and gold left at the end is worth nothing, so spare gold buys an extra life.',
    level_up: `Past ${TARGET_SCORE} points the target is safe, so spare gold raises the dragon level to make harder, better-paid ads winnable.`,
    best_expected_value: 'This ad has the best expected gold of everything on the board.',
    safest_available:
      "Nothing pays well. Score can't go down, so trying the safest ad left beats stopping.",
    no_viable_option: 'No ad or item is worth the turn right now.',
    player_choice: 'You chose this move.',
  } satisfies Record<DecisionRule, string>,
} as const;
