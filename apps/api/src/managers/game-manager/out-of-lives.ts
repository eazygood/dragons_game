import type { GameState } from '@bigbank-dragon/contracts';

// A move that takes the last life still returns 200 upstream; the next call would be a 410.
export const isOutOfLives = ({ state }: { state: GameState }): boolean => state.lives <= 0;
