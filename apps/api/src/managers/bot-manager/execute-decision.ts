import type { Ad, Decision, ShopItem } from '@bigbank-dragon/contracts';

import type { CalibrationAttempt } from '../../domain/engine/calibration.ts';
import type { OrGameOver } from '../../entities/or-game-over.ts';
import type { SavedTurn } from '../../entities/turn-result.ts';
import { DecisionInvariantError } from '../../errors/decision-invariant-error.ts';
import { playBuyTurn, playSolveTurn } from '../game-manager/index.ts';
import type { MoveContext } from '../game-manager/index.ts';

// `attempt` is the calibration evidence a solve produced; a purchase produces none.
export type ExecutedDecision = SavedTurn & { attempt: CalibrationAttempt | null };

export const executeDecision = async ({
  context,
  decision,
  board,
  shop,
}: {
  context: MoveContext;
  decision: Exclude<Decision, { kind: 'stop' }>;
  board: Ad[];
  shop: ShopItem[];
}): Promise<OrGameOver<ExecutedDecision>> => {
  if (decision.kind === 'buy') {
    const item = shop.find((candidate) => candidate.id === decision.itemId);

    if (!item) {
      throw new DecisionInvariantError({
        message: `Decision names item ${decision.itemId}, which is not in the shop`,
      });
    }

    const boughtTurn = await playBuyTurn({ context, item, reasoning: decision.reasoning });

    if (boughtTurn.status === 'game_over') {
      return boughtTurn;
    }

    return { status: 'ok', value: { ...boughtTurn.value, attempt: null } };
  }

  const ad = board.find((candidate) => candidate.adId === decision.adId);

  if (!ad) {
    throw new DecisionInvariantError({
      message: `Decision names ad ${decision.adId}, which is not on the board`,
    });
  }

  const solvedTurn = await playSolveTurn({ context, ad, reasoning: decision.reasoning });

  if (solvedTurn.status === 'game_over') {
    return solvedTurn;
  }

  const { turn } = solvedTurn.value;

  return {
    status: 'ok',
    value: {
      ...solvedTurn.value,
      attempt: {
        probability: ad.probability,
        dragonLevel: context.state.dragonLevel,
        reward: ad.reward,
        success: turn.success,
      },
    },
  };
};
