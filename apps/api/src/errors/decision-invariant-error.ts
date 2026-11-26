import { AppError } from './app-error.ts';

// The engine named something the turn's own board or shop does not hold: a bug here, never
// bad input, so it answers 500 and the cause is logged.
export class DecisionInvariantError extends AppError {
  constructor({ message, cause }: { message: string; cause?: unknown }) {
    super({ code: 'internal', message, statusCode: 500, cause });
  }
}
