import { AppError } from './AppError';

const HTTP_CONFLICT = 409;

export class ConflictError extends AppError {
  readonly statusCode = HTTP_CONFLICT;
  readonly code = 'CONFLICT';
}
