import type { RespostaDissertativa } from '../generated/prisma/client';
import type { RespostaDissertativaRepository } from '../repositories/RespostaDissertativaRepository';
import type { AcessoExercicioService } from './AcessoExercicioService';

/**
 * Resposta dissertativa do aluno, salva automaticamente pela tela do exercício. Até aqui o
 * texto só existia no navegador: a revisão do professor e o PDF liam uma tabela que
 * ninguém preenchia. Escrever segue as mesmas regras de entrega do SQL e do diagrama
 * (matrícula, turma encerrada, prazo); ler, as de leitura.
 */
export class RespostaDissertativaService {
  constructor(
    private readonly respostaDissertativaRepository: RespostaDissertativaRepository,
    private readonly acessoExercicio: AcessoExercicioService,
  ) {}

  async salvar(usuarioId: string, exercicioId: string, texto: string): Promise<RespostaDissertativa> {
    await this.acessoExercicio.exigirEntrega(usuarioId, exercicioId);
    return this.respostaDissertativaRepository.salvar(exercicioId, usuarioId, texto);
  }

  async buscar(usuarioId: string, exercicioId: string): Promise<RespostaDissertativa | null> {
    await this.acessoExercicio.exigirLeitura(usuarioId, exercicioId);
    return this.respostaDissertativaRepository.findByExercicioEUsuario(exercicioId, usuarioId);
  }
}
