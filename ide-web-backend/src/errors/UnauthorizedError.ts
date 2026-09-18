import { AppError } from './AppError';

const HTTP_UNAUTHORIZED = 401;

export class UnauthorizedError extends AppError {
  readonly statusCode = HTTP_UNAUTHORIZED;
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Unauthorized') {
    super(message);
  }
}
