import { AppError } from './AppError';

const HTTP_SERVICE_UNAVAILABLE = 503;

export class LlmIndisponivelError extends AppError {
  readonly statusCode = HTTP_SERVICE_UNAVAILABLE;
  readonly code = 'LLM_UNAVAILABLE';

  constructor(message = 'Serviço de dicas de IA indisponível no momento, tente novamente em instantes') {
    super(message);
  }
}
