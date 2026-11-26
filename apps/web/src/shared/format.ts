const PERCENT = 100;

export const formatChance = ({ winChance }: { winChance: number }) =>
  `${Math.round(winChance * PERCENT)}%`;

export const formatGold = ({ gold }: { gold: number }) => {
  const rounded = Math.round(gold);

  return `${rounded > 0 ? '+' : ''}${rounded} gold`;
};
