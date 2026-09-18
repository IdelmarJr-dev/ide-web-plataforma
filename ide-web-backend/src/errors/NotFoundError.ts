import { AppError } from './AppError';

const HTTP_NOT_FOUND = 404;

// Gênero do recurso, pra mensagem sair em português correto ("Turma não encontrada",
// "Exercício não encontrado"). A mensagem chega ao usuário: a interface é toda em português.
const FEMININOS = new Set(['Turma', 'Prova', 'Pesquisa', 'Submissão']);

export class NotFoundError extends AppError {
  readonly statusCode = HTTP_NOT_FOUND;
  readonly code = 'NOT_FOUND';

  constructor(resource: string) {
    super(`${resource} não ${FEMININOS.has(resource) ? 'encontrada' : 'encontrado'}`);
  }
}
