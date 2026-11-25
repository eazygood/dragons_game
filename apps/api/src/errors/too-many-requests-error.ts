import { AppError } from './app-error.ts';

export class TooManyRequestsError extends AppError {
  constructor({ message, cause }: { message: string; cause?: unknown }) {
    super({ code: 'too_many_requests', message, statusCode: 429, cause });
  }
}
