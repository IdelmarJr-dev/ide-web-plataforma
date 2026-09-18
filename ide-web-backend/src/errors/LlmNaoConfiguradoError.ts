import { AppError } from './AppError';

const HTTP_SERVICE_UNAVAILABLE = 503;

/**
 * Ambiente sem `LLM_API_KEY`. Diferente de `LlmIndisponivelError` (falha passageira do
 * provedor): isto não se resolve tentando de novo, e a interface precisa saber disso
 * pra não mandar o aluno "tentar em instantes" pra sempre.
 */
export class LlmNaoConfiguradoError extends AppError {
  readonly statusCode = HTTP_SERVICE_UNAVAILABLE;
  readonly code = 'LLM_NAO_CONFIGURADO';

  constructor(message = 'Dicas de IA não configuradas neste ambiente') {
    super(message);
  }
}
