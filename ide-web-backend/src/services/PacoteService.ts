import type { Exercicio, RespostaDissertativa, SubmissaoSql } from '../generated/prisma/client';
import type { ImagemModeloPdf } from '../lib/pacotePdf';
import type { RespostaDissertativaRepository } from '../repositories/RespostaDissertativaRepository';
import type { ResultadoExercicioRepository } from '../repositories/ResultadoExercicioRepository';
import type { SandboxProvisioningRepository } from '../repositories/sandbox/SandboxProvisioningRepository';
import type { SubmissaoSqlRepository } from '../repositories/SubmissaoSqlRepository';
import type { AcessoExercicioService } from './AcessoExercicioService';
import { nomeSchemaSandbox } from '../utils/sandboxSchema';

export interface DadosPacote {
  exercicio: Exercicio;
  submissaoSql: SubmissaoSql | null;
  respostaDissertativa: RespostaDissertativa | null;
  imagensModelos: ImagemModeloPdf[];
  sqlModelo: string | null;
}

/** O que o navegador do aluno manda junto: imagens dos modelos e o SQL gerado deles. */
export interface ModelagemDoPacote {
  imagensModelos: ImagemModeloPdf[];
  sqlModelo: string | null;
}

export class PacoteService {
  constructor(
    private readonly acessoExercicio: AcessoExercicioService,
    private readonly submissaoRepository: SubmissaoSqlRepository,
    private readonly respostaDissertativaRepository: RespostaDissertativaRepository,
    private readonly resultadoRepository: ResultadoExercicioRepository,
    private readonly provisioningRepository: SandboxProvisioningRepository,
  ) {}

  async gerar(usuarioId: string, exercicioId: string, modelagem: ModelagemDoPacote): Promise<DadosPacote> {
    const exercicio = await this.acessoExercicio.exigirLeitura(usuarioId, exercicioId);

    const [submissaoSql, respostaDissertativa] = await Promise.all([
      this.submissaoRepository.findUltimaTentativa(usuarioId, exercicioId),
      this.respostaDissertativaRepository.findByExercicioEUsuario(exercicioId, usuarioId),
    ]);

    return { exercicio, submissaoSql, respostaDissertativa, ...modelagem };
  }

  /**
   * Encerrar o exercício: marca a data e derruba o schema do sandbox. Baixar o PDF
   * deixou de disparar isso — são ações separadas desde a Fase 8. O PDF continua
   * saindo depois, porque ele é montado da submissão persistida e não do schema vivo.
   */
  async finalizar(usuarioId: string, exercicioId: string): Promise<void> {
    await this.acessoExercicio.exigirEntrega(usuarioId, exercicioId);
    await this.resultadoRepository.marcarFinalizado(usuarioId, exercicioId, new Date());

    const schemaName = nomeSchemaSandbox(exercicioId, usuarioId);
    await this.provisioningRepository.dropSchema(schemaName);
  }

}
