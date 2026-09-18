import { config } from '../config';
import type { EnviarSandboxResponseDto, TestarSandboxResponseDto } from '../dtos/sandbox.dto';
import type { Prisma } from '../generated/prisma/client';
import type { SandboxExecutionRepository } from '../repositories/sandbox/SandboxExecutionRepository';
import type { SandboxProvisioningRepository } from '../repositories/sandbox/SandboxProvisioningRepository';
import type { ResultadoExercicioRepository } from '../repositories/ResultadoExercicioRepository';
import type { SubmissaoSqlRepository } from '../repositories/SubmissaoSqlRepository';
import type { AcessoExercicioService } from './AcessoExercicioService';
import { nomeSchemaSandbox, nomeSchemaSandboxLivre } from '../utils/sandboxSchema';

function normalizarLinha(linha: Record<string, unknown>): string {
  const chavesOrdenadas = Object.keys(linha).sort();
  return JSON.stringify(chavesOrdenadas.map((chave) => [chave, linha[chave]]));
}

function compararLinhas(alunoLinhas: Record<string, unknown>[], gabaritoLinhas: Record<string, unknown>[]): boolean {
  if (alunoLinhas.length !== gabaritoLinhas.length) {
    return false;
  }

  const alunoNormalizado = alunoLinhas.map(normalizarLinha).sort();
  const gabaritoNormalizado = gabaritoLinhas.map(normalizarLinha).sort();
  return alunoNormalizado.every((linha, index) => linha === gabaritoNormalizado[index]);
}

export class SandboxSqlService {
  constructor(
    private readonly provisioningRepository: SandboxProvisioningRepository,
    private readonly executionRepository: SandboxExecutionRepository,
    private readonly submissaoRepository: SubmissaoSqlRepository,
    private readonly acessoExercicio: AcessoExercicioService,
    private readonly resultadoRepository: ResultadoExercicioRepository,
  ) {}

  async testar(usuarioId: string, exercicioId: string, sql: string): Promise<TestarSandboxResponseDto> {
    // `exigirTeste`, não `exigirEntrega`: questão de prova não permite testar (Fase 10, D9).
    const exercicio = await this.acessoExercicio.exigirTeste(usuarioId, exercicioId);
    const schemaName = nomeSchemaSandbox(exercicioId, usuarioId);
    await this.provisioningRepository.garantirSchema(schemaName, usuarioId, exercicio.sql_setup);

    return this.executionRepository.executar(schemaName, usuarioId, sql, config.sandbox.statementTimeoutMs);
  }

  /** Estudo livre: banco próprio do aluno, sem exercício, sem submissão registrada. */
  async executarLivre(usuarioId: string, sql: string): Promise<TestarSandboxResponseDto> {
    const schemaName = nomeSchemaSandboxLivre(usuarioId);
    await this.provisioningRepository.garantirSchemaLivre(schemaName, usuarioId);

    return this.executionRepository.executar(schemaName, usuarioId, sql, config.sandbox.statementTimeoutMs);
  }

  /** Recomeça o banco livre do zero (o aluno é quem ocupa espaço nele). */
  async limparLivre(usuarioId: string): Promise<void> {
    await this.provisioningRepository.dropSchema(nomeSchemaSandboxLivre(usuarioId));
  }

  async enviar(usuarioId: string, exercicioId: string, sql: string): Promise<EnviarSandboxResponseDto> {
    const exercicio = await this.acessoExercicio.exigirEntrega(usuarioId, exercicioId);
    const schemaName = nomeSchemaSandbox(exercicioId, usuarioId);
    await this.provisioningRepository.garantirSchema(schemaName, usuarioId, exercicio.sql_setup);

    const timeoutMs = config.sandbox.statementTimeoutMs;
    const inicio = Date.now();
    const resultadoAluno = await this.executionRepository.executar(schemaName, usuarioId, sql, timeoutMs);
    const tempoExecucaoMs = Date.now() - inicio;

    // A liberação vale para um envio e é consumida aqui, mesmo que a consulta falhe:
    // o professor concedeu uma chance, não uma janela aberta (Fase 10, D8).
    await this.acessoExercicio.consumirLiberacao(usuarioId, exercicioId);

    const tentativaNumero = await this.submissaoRepository.proximoNumeroTentativa(usuarioId, exercicioId);

    if (resultadoAluno.status !== 'sucesso') {
      const submissao = await this.submissaoRepository.criarComLog({
        exercicio_id: exercicioId,
        usuario_id: usuarioId,
        query_sql: sql,
        resultado_status: resultadoAluno.status,
        linhas_retornadas: null,
        tempo_execucao_ms: tempoExecucaoMs,
        correta: null,
        tentativa_numero: tentativaNumero,
      });

      return { ...resultadoAluno, correta: null, submissaoId: submissao.id, tentativaNumero, plano: null };
    }

    let correta: boolean | null = null;
    if (exercicio.sql_gabarito) {
      const resultadoGabarito = await this.executionRepository.executar(
        schemaName,
        usuarioId,
        exercicio.sql_gabarito,
        timeoutMs,
      );
      correta = resultadoGabarito.status === 'sucesso' && compararLinhas(resultadoAluno.rows, resultadoGabarito.rows);
    }

    const explainJson = await this.executionRepository.explain(schemaName, usuarioId, sql, timeoutMs);

    const submissao = await this.submissaoRepository.criarComLog({
      exercicio_id: exercicioId,
      usuario_id: usuarioId,
      query_sql: sql,
      resultado_status: 'sucesso',
      linhas_retornadas: resultadoAluno.rows.length,
      tempo_execucao_ms: tempoExecucaoMs,
      correta,
      tentativa_numero: tentativaNumero,
      explain_json: explainJson as Prisma.InputJsonValue,
    });

    // Sem gabarito não há veredito, e submissão que nem rodou não diz nada sobre acerto —
    // nos dois casos `correta` é nula e o resultado do exercício fica intocado.
    if (correta !== null) {
      await this.resultadoRepository.upsertAcertoAutomatico(usuarioId, exercicioId, correta);
    }

    return {
      status: 'sucesso',
      rows: resultadoAluno.rows,
      correta,
      submissaoId: submissao.id,
      tentativaNumero,
      plano: explainJson ?? null,
    };
  }
}
