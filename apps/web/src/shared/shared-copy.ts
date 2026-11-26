export const sharedCopy = {
  game: {
    loading: 'Loading game…',
  },
  status: {
    label: 'Game status',
    score: 'Score',
    gold: 'Gold',
    lives: 'Lives',
    dragonLevel: 'Dragon level',
    turn: 'Turn',
  },
  unavailableGame: {
    invalid_id: { title: 'Not a game id', body: 'That link does not point to a game.' },
    not_found: { title: 'No such game', body: 'No game with that id was started here.' },
    bot_game: {
      title: "The bot's game",
      body: 'The bot is playing this one, so it cannot be played by hand.',
    },
    expired: {
      title: 'This game has expired on the game server',
      body: 'The game server forgets games that sit idle for a while, so this one can no longer be played.',
    },
    watchBot: 'Watch the bot',
    startNewGame: 'Start a new game',
  },
  routeFallback: {
    notFoundTitle: 'Page not found',
    notFoundBody: 'There is nothing at this address.',
  },
  backToStart: 'Back to start',
  botStarting: 'Starting the bot…',
  errors: {
    upstreamUnavailable: 'The game is safe, but the Mugloar server is not answering. Try again.',
    unreachable: 'Cannot reach the game server. Check your connection and try again.',
    tooManyRequests: 'Too many requests in a short time. Wait a moment, then try again.',
    serviceUnavailable: 'The game service is temporarily unavailable. Try again in a moment.',
    unexpected: 'Something went wrong on our side. Try again.',
    retry: 'Retry',
    retrying: 'Retrying…',
    refreshFailed: 'Could not refresh the game. Showing the last known state.',
  },
  appTitle: 'Dragons of Mugloar',
} as const;
