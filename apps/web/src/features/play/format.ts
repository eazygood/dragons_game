const PERCENT = 100;

export const formatPercent = ({ probability }: { probability: number }) =>
  `${Math.round(probability * PERCENT)}%`;

export const formatGold = ({ gold }: { gold: number }) => {
  const rounded = Math.round(gold);

  return `${rounded > 0 ? '+' : ''}${rounded} gold`;
};
