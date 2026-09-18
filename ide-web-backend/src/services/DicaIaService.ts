import { config } from '../config';
import type { PedirDicaBodyDto } from '../dtos/dicaIa.dto';
import { ConflictError, ValidationError } from '../errors';
import type { ContextoDica, DicaIa, Exercicio, Prisma } from '../generated/prisma/client';
import type { LlmClient } from '../repositories/llm/GroqLlmClient';
import type { DicaIaRepository } from '../repositories/DicaIaRepository';
import type { ExercicioRepository } from '../repositories/ExercicioRepository';
import type { ResultadoExercicioRepository } from '../repositories/ResultadoExercicioRepository';
import type { SubmissaoSqlRepository } from '../repositories/SubmissaoSqlRepository';
import type { AcessoExercicioService } from './AcessoExercicioService';
import { gerarSql } from '../utils/modelagem/gerarSql';
import { resumirConceitual } from '../utils/modelagem/resumoConceitual';

const MAX_DICAS_POR_CONTEXTO = 5;

export class DicaIaService {
  constructor(
    private readonly dicaIaRepository: DicaIaRepository,
    private readonly exercicioRepository: ExercicioRepository,
    private readonly acessoExercicio: AcessoExercicioService,
    private readonly submissaoSqlRepository: SubmissaoSqlRepository,
    private readonly resultadoExercicioRepository: ResultadoExercicioRepository,
    private readonly llmClient: LlmClient,
  ) {}

  async pedir(usuarioId: string, exercicioId: string, input: PedirDicaBodyDto): Promise<DicaIa> {
    const exercicio = await this.acessoExercicio.exigirLeitura(usuarioId, exercicioId);
    this.exigirParteDoExercicio(exercicio, input.contexto);
    await this.exigirQuotaDisponivel(usuarioId, exercicioId, input.contexto);

    const ultimoErro = await this.buscarUltimoErro(usuarioId, exercicioId, input.contexto);
    const promptMontado = this.montarPrompt(exercicio, input, ultimoErro);

    const resposta = await this.llmClient.gerarDica(promptMontado);

    return this.dicaIaRepository.criar({
      usuario_id: usuarioId,
      exercicio_id: exercicioId,
      contexto: input.contexto,
      estado_enviado: this.montarEstadoEnviado(exercicio, input),
      prompt_montado: promptMontado,
      resposta_ia: resposta.texto,
      modelo_llm: config.llm.model,
      tokens_usados: resposta.tokensUsados,
    });
  }

  private exigirParteDoExercicio(exercicio: Exercicio, contexto: ContextoDica): void {
    if (contexto === 'sql' && !exercicio.sql_gabarito) {
      throw new ValidationError('Este exercício não tem parte de SQL');
    }

    if (contexto === 'mer' && !exercicio.mer_gabarito) {
      throw new ValidationError('Este exercício não tem parte de MER');
    }
  }

  private async exigirQuotaDisponivel(usuarioId: string, exercicioId: string, contexto: ContextoDica): Promise<void> {
    const dicasUsadas = await this.dicaIaRepository.contarPorContexto(usuarioId, exercicioId, contexto);
    if (dicasUsadas >= MAX_DICAS_POR_CONTEXTO) {
      throw new ConflictError(`Limite de ${MAX_DICAS_POR_CONTEXTO.toString()} dicas atingido para esta parte do exercício`);
    }
  }

  private async buscarUltimoErro(usuarioId: string, exercicioId: string, contexto: ContextoDica): Promise<string | null> {
    if (contexto === 'sql') {
      const ultimaTentativa = await this.submissaoSqlRepository.findUltimaTentativa(usuarioId, exercicioId);
      if (!ultimaTentativa) {
        return null;
      }

      if (ultimaTentativa.resultado_status !== 'sucesso') {
        return `Última submissão teve ${ultimaTentativa.resultado_status.replace('_', ' ')}.`;
      }

      return ultimaTentativa.correta === false ? 'Última submissão executou, mas o resultado estava incorreto.' : null;
    }

    const resultado = await this.resultadoExercicioRepository.findByUsuarioEExercicio(usuarioId, exercicioId);
    if (resultado?.mer_avaliacao === null || resultado?.mer_avaliacao === undefined) {
      return null;
    }

    return `Última avaliação do diagrama MER: ${resultado.mer_avaliacao.toString()}/10.`;
  }

  private montarEstadoEnviado(exercicio: Exercicio, input: PedirDicaBodyDto): Prisma.InputJsonValue {
    return {
      ...(exercicio.mer_gabarito && input.estadoMer ? { mer: input.estadoMer } : {}),
      ...(exercicio.sql_gabarito && input.estadoSql ? { sql: input.estadoSql } : {}),
    };
  }

  private montarPrompt(exercicio: Exercicio, input: PedirDicaBodyDto, ultimoErro: string | null): string {
    const partes = [
      `Enunciado do exercício: ${exercicio.enunciado}`,
      `O aluno pediu ajuda na parte: ${input.contexto === 'sql' ? 'consulta SQL' : 'diagrama MER'}`,
    ];

    // Só manda a parte que o exercício realmente tem — e o modelo vai como SQL gerado do
    // modelo lógico (mais curto e legível pro LLM que o JSON do canvas).
    const temMer = Boolean(exercicio.mer_gabarito && input.estadoMer);
    const sqlAtual = exercicio.sql_gabarito ? (input.estadoSql?.trim() ?? '') : '';

    if (temMer && input.estadoMer) {
      // Conceitual primeiro: é o que o aluno enxerga quando o exercício tem os dois níveis.
      const resumo = input.estadoMer.conceitual ? resumirConceitual(input.estadoMer.conceitual) : '';
      if (resumo) {
        partes.push(`Modelo conceitual atual do aluno (notação de Chen, cardinalidade (mín,máx) junto da entidade):\n${resumo}`);
      }

      // No modo puramente conceitual não há lógico: mandar "(modelo lógico vazio)" só confundiria.
      const logico = input.estadoMer.logico ?? { tabelas: [], notas: [] };
      if (logico.tabelas.length > 0 || !resumo) {
        const sqlDoModelo = gerarSql(logico);
        partes.push(`Modelo lógico atual do aluno, convertido em SQL (DDL):\n${sqlDoModelo.sql || '(modelo lógico vazio)'}`);
        if (sqlDoModelo.avisos.length > 0) {
          partes.push(`Problemas detectados automaticamente no modelo:\n- ${sqlDoModelo.avisos.join('\n- ')}`);
        }
      }
    }

    if (sqlAtual) {
      partes.push(`Consulta SQL atual do aluno:\n${sqlAtual}`);
    }

    if (temMer && sqlAtual) {
      partes.push(
        'Verifique também a coerência entre o modelo e a consulta: tabelas ou colunas usadas na consulta ' +
          'que não existem no modelo, ou chaves estrangeiras do modelo que a consulta deveria usar.',
      );
    }

    if (ultimoErro) {
      partes.push(`Erro da última submissão: ${ultimoErro}`);
    }

    return partes.join('\n\n');
  }
}
