const GAMES_ROOT = '/api/games';
const BOT_GAMES_ROOT = '/api/bot-games';

const encodePathSegment = (value: string) => encodeURIComponent(value);

export const gamePaths = {
  games: () => GAMES_ROOT,
  botGames: () => BOT_GAMES_ROOT,
  game: ({ gameId }: { gameId: string }) => `${GAMES_ROOT}/${encodePathSegment(gameId)}`,
  turn: ({ gameId }: { gameId: string }) => `${GAMES_ROOT}/${encodePathSegment(gameId)}/turn`,
  moves: ({ gameId }: { gameId: string }) => `${GAMES_ROOT}/${encodePathSegment(gameId)}/moves`,
  solve: ({ gameId, adId }: { gameId: string; adId: string }) =>
    `${GAMES_ROOT}/${encodePathSegment(gameId)}/ads/${encodePathSegment(adId)}/solve`,
  buy: ({ gameId, itemId }: { gameId: string; itemId: string }) =>
    `${GAMES_ROOT}/${encodePathSegment(gameId)}/shop/${encodePathSegment(itemId)}/buy`,
};
