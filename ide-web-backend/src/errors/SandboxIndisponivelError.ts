import { AppError } from './AppError';

const HTTP_SERVICE_UNAVAILABLE = 503;

export class SandboxIndisponivelError extends AppError {
  readonly statusCode = HTTP_SERVICE_UNAVAILABLE;
  readonly code = 'SANDBOX_UNAVAILABLE';

  constructor(message = 'Não foi possível conectar ao banco do sandbox. Tente novamente em instantes.') {
    super(message);
  }
}
