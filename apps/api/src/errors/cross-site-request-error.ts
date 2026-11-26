import { AppError } from './app-error.ts';

// Reuses invalid_request: a new code would break the web's exhaustive error-copy map, and a
// browser is the only client that can trigger this.
export class CrossSiteRequestError extends AppError {
  constructor({ message, cause }: { message: string; cause?: unknown }) {
    super({ code: 'invalid_request', message, statusCode: 403, cause });
  }
}
