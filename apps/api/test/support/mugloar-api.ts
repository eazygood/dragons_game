import { vi } from 'vitest';

export const LIVE_AD = {
  adId: 'BR0b2WyN',
  message: 'Help Gisilfrid Jephson to transport a magic wagon to village in Blackcawl',
  reward: 17,
  expiresIn: 7,
  encrypted: null,
  probability: 'Piece of cake',
};

// The adapter reads its config on every request, so this redirects it immediately.
export const pointAdapterAt = ({ baseUrl }: { baseUrl: string }) => {
  vi.stubEnv('MUGLOAR_BASE_URL', baseUrl);
};
