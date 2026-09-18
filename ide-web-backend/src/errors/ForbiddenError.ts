import { AppError } from './AppError';

const HTTP_FORBIDDEN = 403;

export class ForbiddenError extends AppError {
  readonly statusCode = HTTP_FORBIDDEN;
  readonly code = 'FORBIDDEN';

  constructor(message = 'Forbidden') {
    super(message);
  }
}
