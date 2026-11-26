import { HEALING_POTION_ID } from '@bigbank-dragon/contracts';
import type { GameState, ShopItem } from '@bigbank-dragon/contracts';

import { priorCalibration, withAttempt } from '../../src/domain/engine/calibration.ts';
import type { MeasuredCalibration } from '../../src/domain/engine/calibration.ts';
import { decide } from '../../src/domain/engine/decide.ts';
import { STRATEGY_CONFIG } from '../../src/domain/engine/strategy-config.ts';
import type { StrategyConfig } from '../../src/domain/engine/strategy-config.ts';
import type { BotStrategy } from '../../src/entities/bot-run.ts';
import { drawBoard, randomFor, succeeds } from './simulated-world.ts';

// A seeded model of the game for regression-testing the strategy, not evidence about the
// live one: boards follow the recorded label mix and the hidden success rates are the live
// ones. The real `decide` plays it, so an engine change moves the scores.

export const SIMULATED_TURN_CAP = 150;
const STARTING_LIVES = 3;
const POTION_COST = 50;
const SHOP: ShopItem[] = [{ id: HEALING_POTION_ID, name: 'Healing potion', cost: POTION_COST }];

export type SimulatedGame = {
  seed: number;
  score: number;
  turns: number;
  lifeLosses: number;
  endedBy: 'out_of_lives' | 'turn_cap' | 'stopped';
  calibration: MeasuredCalibration;
};

type SimulationInput = {
  seed: number;
  strategy: BotStrategy;
  config?: StrategyConfig;
  // A warm start: evidence gathered by earlier games, as the benchmark's `--warm` reads it.
  startingCalibration?: MeasuredCalibration;
};

export const simulateGame = ({
  seed,
  strategy,
  config = STRATEGY_CONFIG,
  startingCalibration = priorCalibration({ config }),
}: SimulationInput): SimulatedGame => {
  const random = randomFor({ seed });
  let calibration = startingCalibration;
  let state: GameState = {
    gameId: `sim-${seed}`,
    lives: STARTING_LIVES,
    gold: 0,
    dragonLevel: 0,
    turn: 0,
    score: 0,
  };
  let lifeLosses = 0;
  let endedBy: SimulatedGame['endedBy'] = 'turn_cap';

  while (state.turn < SIMULATED_TURN_CAP) {
    const board = drawBoard({ random, turn: state.turn });
    const decision = decide({ state, board, shop: SHOP, calibration, config });

    if (decision.kind === 'stop') {
      endedBy = 'stopped';
      break;
    }

    if (decision.kind === 'buy') {
      state = { ...state, gold: state.gold - POTION_COST, lives: state.lives + 1 };
    } else {
      const ad = board.find((candidate) => candidate.adId === decision.adId)!;
      const success = succeeds({ ad, random });

      if (strategy === 'calibrated') {
        const attempt = {
          probability: ad.probability,
          dragonLevel: state.dragonLevel,
          reward: ad.reward,
          success,
        };

        calibration = withAttempt({ calibration, attempt });
      }

      lifeLosses += success ? 0 : 1;
      state = success
        ? { ...state, gold: state.gold + ad.reward, score: state.score + ad.reward }
        : { ...state, lives: state.lives - 1 };
    }

    state = { ...state, turn: state.turn + 1 };

    if (state.lives <= 0) {
      endedBy = 'out_of_lives';
      break;
    }
  }

  return { seed, score: state.score, turns: state.turn, lifeLosses, endedBy, calibration };
};

export const simulateMany = ({
  seeds,
  ...input
}: Omit<SimulationInput, 'seed'> & { seeds: number[] }): SimulatedGame[] =>
  seeds.map((seed) => simulateGame({ seed, ...input }));
