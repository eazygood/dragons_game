import type { Move } from '@dragons-game/contracts';

// A turn is not contractually limited to one move of a kind, so the key counts repeats.
// New moves arrive at the front; counting from the front would renumber every row.
export const keyedMoves = ({ moves }: { moves: Move[] }) => {
  const repeatsByKey = new Map<string, number>();

  return [...moves]
    .reverse()
    .map((move) => {
      const baseKey = `${move.kind}-${move.turn}`;
      const repeats = repeatsByKey.get(baseKey) ?? 0;

      repeatsByKey.set(baseKey, repeats + 1);

      return { move, key: `${baseKey}-${repeats}` };
    })
    .reverse();
};
