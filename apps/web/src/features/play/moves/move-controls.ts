export type MoveControls = {
  solve: (adId: string) => void;
  buy: (itemId: string) => void;
  isPending: boolean;
};
