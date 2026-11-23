import type { Ad } from '@bigbank-dragon/contracts';

import type { UpstreamResult } from '../../entities/upstream-result.ts';
import { adRepository } from '../../repositories/index.ts';

export const findAds = ({ gameId }: { gameId: string }): Promise<UpstreamResult<Ad[]>> =>
  adRepository.mugloar.findMany({ gameId });
