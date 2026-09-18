import { AppError } from './AppError';

const HTTP_TOO_MANY_REQUESTS = 429;

export class TooManyRequestsError extends AppError {
  readonly statusCode = HTTP_TOO_MANY_REQUESTS;
  readonly code = 'TOO_MANY_REQUESTS';

  constructor(message = 'Too many requests') {
    super(message);
  }
}
