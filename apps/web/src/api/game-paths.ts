const GAMES_ROOT = '/api/games';
const BOT_GAMES_ROOT = '/api/bot-games';

export const gamePaths = {
  games: () => GAMES_ROOT,
  botGames: () => BOT_GAMES_ROOT,
  game: ({ gameId }: { gameId: string }) => `${GAMES_ROOT}/${encodeURIComponent(gameId)}`,
  turn: ({ gameId }: { gameId: string }) => `${GAMES_ROOT}/${encodeURIComponent(gameId)}/turn`,
  moveHistory: ({ gameId }: { gameId: string }) =>
    `${GAMES_ROOT}/${encodeURIComponent(gameId)}/moves`,
  solve: ({ gameId, adId }: { gameId: string; adId: string }) =>
    `${GAMES_ROOT}/${encodeURIComponent(gameId)}/ads/${encodeURIComponent(adId)}/solve`,
  buy: ({ gameId, itemId }: { gameId: string; itemId: string }) =>
    `${GAMES_ROOT}/${encodeURIComponent(gameId)}/shop/${encodeURIComponent(itemId)}/buy`,
};
