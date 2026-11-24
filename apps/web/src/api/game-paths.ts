const API_ROOT = '/api/games';
const BOT_GAMES_ROOT = '/api/bot-games';

const encodePathSegment = (value: string) => encodeURIComponent(value);

export const gamePaths = {
  games: () => API_ROOT,
  botGames: () => BOT_GAMES_ROOT,
  game: ({ gameId }: { gameId: string }) => `${API_ROOT}/${encodePathSegment(gameId)}`,
  turn: ({ gameId }: { gameId: string }) => `${API_ROOT}/${encodePathSegment(gameId)}/turn`,
  moves: ({ gameId }: { gameId: string }) => `${API_ROOT}/${encodePathSegment(gameId)}/moves`,
  solve: ({ gameId, adId }: { gameId: string; adId: string }) =>
    `${API_ROOT}/${encodePathSegment(gameId)}/ads/${encodePathSegment(adId)}/solve`,
  buy: ({ gameId, itemId }: { gameId: string; itemId: string }) =>
    `${API_ROOT}/${encodePathSegment(gameId)}/shop/${encodePathSegment(itemId)}/buy`,
};
