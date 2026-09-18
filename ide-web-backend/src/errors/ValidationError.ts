import { AppError } from './AppError';

const HTTP_BAD_REQUEST = 400;

export class ValidationError extends AppError {
  readonly statusCode = HTTP_BAD_REQUEST;
  readonly code = 'VALIDATION_ERROR';

  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}
