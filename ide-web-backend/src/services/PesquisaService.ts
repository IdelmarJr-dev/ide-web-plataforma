import { randomInt } from 'node:crypto';
import type { AcertosResponseDto } from '../dtos/pesquisa.dto';
import {
  TCLE_VERSAO_ATUAL,
  montarLinhaExportacao,
  toPesquisaResponseDto,
  toRtlxResponseDto,
  toSessaoResponseDto,
  toSusResponseDto,
  toTcleStatusResponseDto,
} from '../dtos/pesquisaAplicada.dto';
import type {
  ExportacaoResponseDto,
  MinhaParticipacaoResponseDto,
  ParticipantesResponseDto,
  PesquisaResponseDto,
  PesquisaStatusResponseDto,
  RtlxResponseDto,
  SessaoResponseDto,
  SorteioResponseDto,
  SusResponseDto,
  TcleStatusResponseDto,
} from '../dtos/pesquisaAplicada.dto';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors';
import type { Ambiente, Grupo, Pesquisa, SessaoUso } from '../generated/prisma/client';
import type { AlocacaoGrupoRepository } from '../repositories/AlocacaoGrupoRepository';
import type { DicaIaRepository } from '../repositories/DicaIaRepository';
import type { ExercicioRepository } from '../repositories/ExercicioRepository';
import type { MatriculaRepository } from '../repositories/MatriculaRepository';
import type { PesquisaRepository } from '../repositories/PesquisaRepository';
import type { RespostaRtlxRepository } from '../repositories/RespostaRtlxRepository';
import type { RespostaSusRepository } from '../repositories/RespostaSusRepository';
import type { SessaoUsoRepository } from '../repositories/SessaoUsoRepository';
import type { SubmissaoSqlRepository } from '../repositories/SubmissaoSqlRepository';
import type { TcleConsentimentoRepository } from '../repositories/TcleConsentimentoRepository';
import type { UsuarioRepository } from '../repositories/UsuarioRepository';

const GRUPOS_POSSIVEIS = 2;

const AMBIENTE_POR_GRUPO: Record<Grupo, Ambiente> = {
  experimental: 'ide_web',
  controle: 'ferramentas_tradicionais',
};

/** Fisher-Yates com `crypto.randomInt` (CSPRNG) — nunca `Math.random` pra decidir grupo. */
function embaralhar<T>(itens: T[]): T[] {
  const resultado = [...itens];
  for (let indice = resultado.length - 1; indice > 0; indice -= 1) {
    const sorteado = randomInt(0, indice + 1);
    [resultado[indice], resultado[sorteado]] = [resultado[sorteado], resultado[indice]] as [T, T];
  }
  return resultado;
}

/**
 * Pontos de contato do Node com a pesquisa do TCC (código só-pesquisa, removido
 * depois da coleta — ver CLAUDE.md). Guarda TCLE/grupo/sessão/SUS/RTLX (dado de
 * sujeito de pesquisa, anonimizado — só `usuario_id` opaco) e os acertos por aluno
 * que o pesquisador junta na exportação. Ver docs/decisions/fase13-pesquisa-dados-no-node.md.
 */
export class PesquisaService {
  constructor(
    private readonly usuarioRepository: UsuarioRepository,
    private readonly exercicioRepository: ExercicioRepository,
    private readonly matriculaRepository: MatriculaRepository,
    private readonly submissaoSqlRepository: SubmissaoSqlRepository,
    private readonly dicaIaRepository: DicaIaRepository,
    private readonly pesquisaRepository: PesquisaRepository,
    private readonly tcleConsentimentoRepository: TcleConsentimentoRepository,
    private readonly alocacaoGrupoRepository: AlocacaoGrupoRepository,
    private readonly sessaoUsoRepository: SessaoUsoRepository,
    private readonly respostaSusRepository: RespostaSusRepository,
    private readonly respostaRtlxRepository: RespostaRtlxRepository,
  ) {}

  /**
   * Taxa de acerto e tentativas por aluno × exercício da tarefa — métricas
   * complementares do TCC (Resultados Esperados). O grupo controle entrega a query
   * final pela mesma rota de envio do sandbox, então aparece aqui do mesmo jeito.
   */
  async acertos(exercicioIds: string[]): Promise<AcertosResponseDto> {
    const exercicios = await this.exercicioRepository.findByIds(exercicioIds);
    if (exercicios.length !== exercicioIds.length) {
      throw new NotFoundError('Exercício');
    }

    const turmas = new Set(exercicios.map((exercicio) => exercicio.turma_id));
    const [turmaId] = turmas;
    if (turmas.size !== 1 || !turmaId) {
      throw new ValidationError('Os exercícios da tarefa precisam ser da mesma turma');
    }

    const [alunos, submissoes, dicas] = await Promise.all([
      this.matriculaRepository.findAlunosDaTurma(turmaId),
      this.submissaoSqlRepository.findResumoPorExercicios(exercicioIds),
      this.dicaIaRepository.contarPorExercicios(exercicioIds),
    ]);

    const chave = (usuarioId: string, exercicioId: string): string => `${usuarioId}:${exercicioId}`;
    const tentativas = new Map<string, { total: number; acertou: boolean }>();
    for (const submissao of submissoes) {
      const atual = tentativas.get(chave(submissao.usuario_id, submissao.exercicio_id)) ?? { total: 0, acertou: false };
      atual.total += 1;
      atual.acertou ||= submissao.correta === true;
      tentativas.set(chave(submissao.usuario_id, submissao.exercicio_id), atual);
    }
    const dicasPorChave = new Map<string, { sql: number; mer: number }>();
    for (const contagem of dicas) {
      const atual = dicasPorChave.get(chave(contagem.usuario_id, contagem.exercicio_id)) ?? { sql: 0, mer: 0 };
      atual[contagem.contexto] += contagem.total;
      dicasPorChave.set(chave(contagem.usuario_id, contagem.exercicio_id), atual);
    }

    return {
      turmaId,
      exercicioIds,
      alunos: alunos
        .filter((usuario) => usuario.papel === 'aluno')
        .map((aluno) => ({
          usuarioId: aluno.id,
          exercicios: exercicioIds.map((exercicioId) => {
            const envio = tentativas.get(chave(aluno.id, exercicioId));
            const dicasDoAluno = dicasPorChave.get(chave(aluno.id, exercicioId));
            return {
              exercicioId,
              tentativas: envio?.total ?? 0,
              correta: envio ? envio.acertou : null,
              dicasSql: dicasDoAluno?.sql ?? 0,
              dicasMer: dicasDoAluno?.mer ?? 0,
            };
          }),
        })),
    };
  }

  // ---- Pesquisador ----

  async iniciar(pesquisadorId: string, turmaId: string, exercicioIds: string[]): Promise<PesquisaResponseDto> {
    const ativa = await this.pesquisaRepository.buscarAtivaPorTurma(turmaId);
    if (ativa) {
      throw new ConflictError('Já existe uma pesquisa ativa nesta turma. Encerre-a antes de iniciar outra.');
    }

    const pesquisa = await this.pesquisaRepository.criar({
      turma_id: turmaId,
      exercicio_ids: exercicioIds,
      iniciada_por: pesquisadorId,
    });
    return toPesquisaResponseDto(pesquisa);
  }

  async statusPorTurma(turmaId: string): Promise<PesquisaStatusResponseDto> {
    const ativa = await this.pesquisaRepository.buscarAtivaPorTurma(turmaId);
    if (!ativa) {
      return { iniciada: false, pesquisaId: null, iniciadaEm: null, gruposSorteados: false };
    }
    return {
      iniciada: true,
      pesquisaId: ativa.id,
      iniciadaEm: ativa.iniciada_em.toISOString(),
      gruposSorteados: ativa.grupos_sorteados_em !== null,
    };
  }

  async historicoPorTurma(turmaId: string): Promise<PesquisaResponseDto[]> {
    const historico = await this.pesquisaRepository.listarHistoricoPorTurma(turmaId);
    return historico.map(toPesquisaResponseDto);
  }

  /**
   * Aloca em grupo quem aceitou o TCLE e ainda não tem grupo, mantendo os grupos
   * equilibrados (diferença máxima de 1). Nunca reatribui quem já foi alocado —
   * chamar de novo depois de consentimentos tardios só completa os que faltam.
   */
  async sortearGrupos(pesquisaId: string): Promise<SorteioResponseDto> {
    const pesquisa = await this.buscarPesquisaOuFalhar(pesquisaId);
    if (pesquisa.encerrada_em !== null) {
      throw new ConflictError('Esta pesquisa já foi encerrada.');
    }

    const consentimentos = await this.tcleConsentimentoRepository.listarPorPesquisa(pesquisaId);
    const consentidos = consentimentos.filter((consentimento) => consentimento.aceito).map((c) => c.usuario_id);
    const alocacoes = await this.alocacaoGrupoRepository.listarPorPesquisa(pesquisaId);

    const jaAlocados = new Set(alocacoes.map((alocacao) => alocacao.usuario_id));
    const contagem: Record<Grupo, number> = { controle: 0, experimental: 0 };
    for (const alocacao of alocacoes) {
      contagem[alocacao.grupo] += 1;
    }

    const pendentes = embaralhar(consentidos.filter((usuarioId) => !jaAlocados.has(usuarioId)));

    for (const usuarioId of pendentes) {
      const grupo: Grupo =
        contagem.controle === contagem.experimental
          ? randomInt(0, GRUPOS_POSSIVEIS) === 0
            ? 'controle'
            : 'experimental'
          : contagem.controle < contagem.experimental
            ? 'controle'
            : 'experimental';
      contagem[grupo] += 1;
      // Sorteio sequencial: cada iteração precisa ver a contagem já atualizada pela anterior.
      await this.alocacaoGrupoRepository.criar(pesquisaId, usuarioId, grupo);
    }

    if (pesquisa.grupos_sorteados_em === null) {
      await this.pesquisaRepository.marcarGruposSorteados(pesquisaId);
    }

    return { alocadosAgora: pendentes.length, controle: contagem.controle, experimental: contagem.experimental };
  }

  async encerrar(pesquisaId: string): Promise<PesquisaResponseDto> {
    const pesquisa = await this.buscarPesquisaOuFalhar(pesquisaId);
    const encerrada = pesquisa.encerrada_em === null ? await this.pesquisaRepository.encerrar(pesquisaId) : pesquisa;
    return toPesquisaResponseDto(encerrada);
  }

  async participantes(pesquisaId: string): Promise<ParticipantesResponseDto> {
    await this.buscarPesquisaOuFalhar(pesquisaId);

    const [consentimentos, alocacoes, sessoes] = await Promise.all([
      this.tcleConsentimentoRepository.listarPorPesquisa(pesquisaId),
      this.alocacaoGrupoRepository.listarPorPesquisa(pesquisaId),
      this.sessaoUsoRepository.listarPorPesquisa(pesquisaId),
    ]);
    const idsSessoes = sessoes.map((sessao) => sessao.id);
    const [sus, rtlx] = await Promise.all([
      this.respostaSusRepository.listarPorSessaoIds(idsSessoes),
      this.respostaRtlxRepository.listarPorSessaoIds(idsSessoes),
    ]);

    const aceitaram = new Set(consentimentos.filter((c) => c.aceito).map((c) => c.usuario_id));
    const alocados = new Set(alocacoes.map((alocacao) => alocacao.usuario_id));

    return {
      consentiram: aceitaram.size,
      recusaram: consentimentos.filter((c) => !c.aceito).length,
      controle: alocacoes.filter((alocacao) => alocacao.grupo === 'controle').length,
      experimental: alocacoes.filter((alocacao) => alocacao.grupo === 'experimental').length,
      semGrupo: [...aceitaram].filter((usuarioId) => !alocados.has(usuarioId)).length,
      sessoesIniciadas: sessoes.length,
      sessoesFinalizadas: sessoes.filter((sessao) => sessao.finalizada_em !== null).length,
      susRespondidos: sus.length,
      rtlxRespondidos: rtlx.length,
    };
  }

  /**
   * Uma linha por participante que aceitou o TCLE (quem recusou ou desistiu fica de
   * fora), em ordem de consentimento. Sem nome e sem IP — o `usuarioId` só serve pro
   * frontend do pesquisador juntar com os acertos do Node e trocar por P01, P02…
   */
  async exportacao(pesquisaId: string): Promise<ExportacaoResponseDto> {
    const pesquisa = await this.buscarPesquisaOuFalhar(pesquisaId);

    const consentimentos = (await this.tcleConsentimentoRepository.listarPorPesquisa(pesquisaId))
      .filter((consentimento) => consentimento.aceito)
      .sort((a, b) => a.respondido_em.getTime() - b.respondido_em.getTime() || a.id.localeCompare(b.id));

    const alocacaoPorUsuario = new Map(
      (await this.alocacaoGrupoRepository.listarPorPesquisa(pesquisaId)).map((alocacao) => [
        alocacao.usuario_id,
        alocacao,
      ]),
    );
    const sessoes = await this.sessaoUsoRepository.listarPorPesquisa(pesquisaId);
    const sessaoPorUsuario = new Map(sessoes.map((sessao) => [sessao.usuario_id, sessao]));
    const idsSessoes = sessoes.map((sessao) => sessao.id);

    const [sus, rtlx] = await Promise.all([
      this.respostaSusRepository.listarPorSessaoIds(idsSessoes),
      this.respostaRtlxRepository.listarPorSessaoIds(idsSessoes),
    ]);
    const susPorSessao = new Map(sus.map((resposta) => [resposta.sessao_id, resposta]));
    const rtlxPorSessao = new Map(rtlx.map((resposta) => [resposta.sessao_id, resposta]));

    const participantes = consentimentos.map((consentimento) => {
      const sessao = sessaoPorUsuario.get(consentimento.usuario_id);
      return montarLinhaExportacao(
        consentimento,
        alocacaoPorUsuario.get(consentimento.usuario_id),
        sessao,
        sessao ? susPorSessao.get(sessao.id) : undefined,
        sessao ? rtlxPorSessao.get(sessao.id) : undefined,
      );
    });

    return { pesquisa: toPesquisaResponseDto(pesquisa), participantes };
  }

  // ---- Aluno ----

  async minhaParticipacao(usuarioId: string): Promise<MinhaParticipacaoResponseDto> {
    const pesquisa = await this.pesquisaAtivaDoAluno(usuarioId);
    if (!pesquisa) {
      return { pesquisa: null, tcle: 'pendente', grupo: null, ambiente: null, sessao: null, susRespondido: false, rtlxRespondido: false };
    }

    const [consentimento, alocacao, sessao] = await Promise.all([
      this.tcleConsentimentoRepository.buscarPorPesquisaEUsuario(pesquisa.id, usuarioId),
      this.alocacaoGrupoRepository.buscarPorPesquisaEUsuario(pesquisa.id, usuarioId),
      this.sessaoUsoRepository.buscarPorPesquisaEUsuario(pesquisa.id, usuarioId),
    ]);

    const [susRespondido, rtlxRespondido] = sessao
      ? await Promise.all([
          this.respostaSusRepository.existePorSessao(sessao.id),
          this.respostaRtlxRepository.existePorSessao(sessao.id),
        ])
      : [false, false];

    return {
      pesquisa: toPesquisaResponseDto(pesquisa),
      tcle: consentimento === null ? 'pendente' : consentimento.aceito ? 'aceito' : 'recusado',
      grupo: alocacao?.grupo ?? null,
      ambiente: alocacao ? AMBIENTE_POR_GRUPO[alocacao.grupo] : null,
      sessao: sessao ? toSessaoResponseDto(sessao) : null,
      susRespondido,
      rtlxRespondido,
    };
  }

  async consentirTcle(usuarioId: string, aceito: boolean): Promise<TcleStatusResponseDto> {
    const pesquisa = await this.exigirPesquisaAtivaDoAluno(usuarioId);
    const consentimento = await this.tcleConsentimentoRepository.registrar(
      pesquisa.id,
      usuarioId,
      aceito,
      TCLE_VERSAO_ATUAL,
    );
    return toTcleStatusResponseDto(consentimento);
  }

  async iniciarSessao(usuarioId: string): Promise<SessaoResponseDto> {
    const pesquisa = await this.exigirPesquisaAtivaDoAluno(usuarioId);

    const consentimento = await this.tcleConsentimentoRepository.buscarPorPesquisaEUsuario(pesquisa.id, usuarioId);
    if (!consentimento?.aceito) {
      throw new ForbiddenError('É preciso aceitar o TCLE para participar.');
    }

    const alocacao = await this.alocacaoGrupoRepository.buscarPorPesquisaEUsuario(pesquisa.id, usuarioId);
    if (!alocacao) {
      throw new ConflictError('Aguarde o pesquisador sortear os grupos.');
    }

    const existente = await this.sessaoUsoRepository.buscarPorPesquisaEUsuario(pesquisa.id, usuarioId);
    if (existente) {
      throw new ConflictError('Você já iniciou a tarefa desta pesquisa.');
    }

    const sessao = await this.sessaoUsoRepository.criar(pesquisa.id, usuarioId, AMBIENTE_POR_GRUPO[alocacao.grupo]);
    return toSessaoResponseDto(sessao);
  }

  async finalizarSessao(usuarioId: string, sessaoId: string): Promise<SessaoResponseDto> {
    const sessao = await this.buscarSessaoDoUsuarioOuFalhar(sessaoId, usuarioId);
    await this.exigirConsentimentoVigente(sessao.pesquisa_id, usuarioId);

    // Idempotente: um segundo clique não muda a duração já registrada.
    const finalizada = sessao.finalizada_em === null ? await this.sessaoUsoRepository.finalizar(sessaoId) : sessao;
    return toSessaoResponseDto(finalizada);
  }

  async registrarSus(usuarioId: string, sessaoId: string, itens: Record<string, number>, pontuacaoSus: number): Promise<SusResponseDto> {
    const sessao = await this.buscarSessaoDoUsuarioOuFalhar(sessaoId, usuarioId);
    await this.exigirConsentimentoVigente(sessao.pesquisa_id, usuarioId);
    this.exigirSessaoFinalizada(sessao.finalizada_em);

    if (await this.respostaSusRepository.existePorSessao(sessaoId)) {
      throw new ConflictError('O SUS desta sessão já foi respondido.');
    }

    const resposta = await this.respostaSusRepository.criar({
      sessao_id: sessaoId,
      usuario_id: usuarioId,
      itens,
      pontuacao_sus: pontuacaoSus,
    });
    return toSusResponseDto(resposta);
  }

  async registrarRtlx(
    usuarioId: string,
    sessaoId: string,
    dimensoes: Record<string, number>,
    pontuacaoRtlx: number,
  ): Promise<RtlxResponseDto> {
    const sessao = await this.buscarSessaoDoUsuarioOuFalhar(sessaoId, usuarioId);
    await this.exigirConsentimentoVigente(sessao.pesquisa_id, usuarioId);
    this.exigirSessaoFinalizada(sessao.finalizada_em);

    if (await this.respostaRtlxRepository.existePorSessao(sessaoId)) {
      throw new ConflictError('O RTLX desta sessão já foi respondido.');
    }

    const resposta = await this.respostaRtlxRepository.criar({
      sessao_id: sessaoId,
      usuario_id: usuarioId,
      dimensoes,
      pontuacao_rtlx: pontuacaoRtlx,
    });
    return toRtlxResponseDto(resposta);
  }

  // ---- Privado ----

  private async buscarPesquisaOuFalhar(pesquisaId: string): Promise<Pesquisa> {
    const pesquisa = await this.pesquisaRepository.buscarPorId(pesquisaId);
    if (!pesquisa) {
      throw new NotFoundError('Pesquisa');
    }
    return pesquisa;
  }

  /** O aluno pode estar em várias turmas — vale a única que tiver pesquisa aberta. */
  private async pesquisaAtivaDoAluno(usuarioId: string): Promise<Pesquisa | null> {
    const matriculas = await this.matriculaRepository.findByAlunoId(usuarioId);
    const turmaIds = matriculas.map((matricula) => matricula.turma_id);
    return this.pesquisaRepository.buscarAtivaPorTurmaIds(turmaIds);
  }

  private async exigirPesquisaAtivaDoAluno(usuarioId: string): Promise<Pesquisa> {
    const pesquisa = await this.pesquisaAtivaDoAluno(usuarioId);
    if (!pesquisa) {
      throw new ConflictError('Nenhuma pesquisa ativa nas suas turmas.');
    }
    return pesquisa;
  }

  /** 404 tanto pra sessão inexistente quanto pra sessão de outro usuário — não vaza existência. */
  private async buscarSessaoDoUsuarioOuFalhar(sessaoId: string, usuarioId: string): Promise<SessaoUso> {
    const sessao = await this.sessaoUsoRepository.buscarPorId(sessaoId);
    if (sessao?.usuario_id !== usuarioId) {
      throw new NotFoundError('Sessão');
    }
    return sessao;
  }

  private async exigirConsentimentoVigente(pesquisaId: string, usuarioId: string): Promise<void> {
    const consentimento = await this.tcleConsentimentoRepository.buscarPorPesquisaEUsuario(pesquisaId, usuarioId);
    if (!consentimento?.aceito) {
      throw new ForbiddenError('É preciso aceitar o TCLE para participar.');
    }
  }

  private exigirSessaoFinalizada(finalizadaEm: Date | null): void {
    if (finalizadaEm === null) {
      throw new ConflictError('Finalize a tarefa antes de responder os questionários.');
    }
  }
}
