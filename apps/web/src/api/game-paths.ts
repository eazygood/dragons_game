const API_ROOT = '/api/games';

const encodePathSegment = (value: string) => encodeURIComponent(value);

export const gamePaths = {
  games: () => API_ROOT,
  game: ({ gameId }: { gameId: string }) => `${API_ROOT}/${encodePathSegment(gameId)}`,
  turn: ({ gameId }: { gameId: string }) => `${API_ROOT}/${encodePathSegment(gameId)}/turn`,
  solve: ({ gameId, adId }: { gameId: string; adId: string }) =>
    `${API_ROOT}/${encodePathSegment(gameId)}/ads/${encodePathSegment(adId)}/solve`,
  buy: ({ gameId, itemId }: { gameId: string; itemId: string }) =>
    `${API_ROOT}/${encodePathSegment(gameId)}/shop/${encodePathSegment(itemId)}/buy`,
};
