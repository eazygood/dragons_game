import { withAttempt } from '../../domain/engine/calibration.ts';
import type { CalibrationAttempt, MeasuredCalibration } from '../../domain/engine/calibration.ts';
import type { BotStrategy } from '../../entities/bot-run.ts';

// The baseline is defined as playing without evidence, so only the calibrated strategy learns.
export const learnFromAttempt = ({
  strategy,
  calibration,
  attempt,
}: {
  strategy: BotStrategy;
  calibration: MeasuredCalibration;
  attempt: CalibrationAttempt;
}): MeasuredCalibration => {
  switch (strategy) {
    case 'baseline':
      return calibration;
    case 'calibrated':
      return withAttempt({ calibration, attempt });
    default: {
      const unhandled: never = strategy;

      throw new Error(`No calibration for strategy ${String(unhandled)}`);
    }
  }
};
