import { AppError } from './app-error.ts';

export class ServiceUnavailableError extends AppError {
  constructor({ message, cause }: { message: string; cause?: unknown }) {
    super({ code: 'service_unavailable', message, statusCode: 503, cause });
  }
}
