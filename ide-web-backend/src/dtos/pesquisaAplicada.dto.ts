import { z } from 'zod';
import type {
  AlocacaoGrupo,
  Ambiente,
  Grupo,
  Pesquisa,
  RespostaRtlx,
  RespostaSus,
  SessaoUso,
  TcleConsentimento,
} from '../generated/prisma/client';

const MAX_EXERCICIOS_TAREFA = 50;

// Versão vigente do termo — mesmo texto de `features/tcle/components/TermoTexto.tsx`
// e do Apêndice A do TCC. Mudou o texto? Mude os dois.
export const TCLE_VERSAO_ATUAL = '2.0';

export const SUS_ITENS = Array.from({ length: 10 }, (_, indice) => String(indice + 1));
const SUS_MIN = 1;
const SUS_MAX = 5;

export const RTLX_DIMENSOES = [
  'demandaMental',
  'demandaFisica',
  'demandaTemporal',
  'desempenho',
  'esforco',
  'frustracao',
] as const;
const RTLX_MIN = 0;
const RTLX_MAX = 100;
const RTLX_PASSO = 5;

const PONTUACAO_MIN = 0;
const PONTUACAO_MAX = 100;

// ---- Requests ----

export const iniciarPesquisaBodySchema = z.object({
  turmaId: z.uuid(),
  exercicioIds: z
    .array(z.uuid())
    .min(1)
    .max(MAX_EXERCICIOS_TAREFA)
    .transform((ids) => [...new Set(ids)]),
});
export type IniciarPesquisaBodyDto = z.infer<typeof iniciarPesquisaBodySchema>;

export const tcleConsentirBodySchema = z.object({
  aceito: z.boolean(),
});
export type TcleConsentirBodyDto = z.infer<typeof tcleConsentirBodySchema>;

export const susBodySchema = z.object({
  itens: z
    .record(z.string(), z.number().int())
    .refine((itens) => Object.keys(itens).length === SUS_ITENS.length && SUS_ITENS.every((chave) => chave in itens), {
      message: `O SUS precisa das respostas dos ${String(SUS_ITENS.length)} itens (chaves '1' a '10').`,
    })
    .refine((itens) => Object.values(itens).every((valor) => valor >= SUS_MIN && valor <= SUS_MAX), {
      message: 'Cada item do SUS vai de 1 a 5.',
    }),
  pontuacaoSus: z.number().min(PONTUACAO_MIN).max(PONTUACAO_MAX),
});
export type SusBodyDto = z.infer<typeof susBodySchema>;

export const rtlxBodySchema = z.object({
  dimensoes: z
    .record(z.string(), z.number().int())
    .refine(
      (dimensoes) =>
        Object.keys(dimensoes).length === RTLX_DIMENSOES.length &&
        RTLX_DIMENSOES.every((chave) => chave in dimensoes),
      { message: `O RTLX precisa das ${String(RTLX_DIMENSOES.length)} dimensões: ${RTLX_DIMENSOES.join(', ')}.` },
    )
    .refine(
      (dimensoes) =>
        Object.values(dimensoes).every((valor) => valor >= RTLX_MIN && valor <= RTLX_MAX && valor % RTLX_PASSO === 0),
      { message: 'Cada dimensão do RTLX vai de 0 a 100, de 5 em 5.' },
    ),
  pontuacaoRtlx: z.number().min(PONTUACAO_MIN).max(PONTUACAO_MAX),
});
export type RtlxBodyDto = z.infer<typeof rtlxBodySchema>;

// ---- Responses ----

export interface PesquisaResponseDto {
  id: string;
  turmaId: string;
  exercicioIds: string[];
  iniciadaEm: string;
  gruposSorteadosEm: string | null;
  encerradaEm: string | null;
}

export function toPesquisaResponseDto(pesquisa: Pesquisa): PesquisaResponseDto {
  return {
    id: pesquisa.id,
    turmaId: pesquisa.turma_id,
    exercicioIds: pesquisa.exercicio_ids,
    iniciadaEm: pesquisa.iniciada_em.toISOString(),
    gruposSorteadosEm: pesquisa.grupos_sorteados_em?.toISOString() ?? null,
    encerradaEm: pesquisa.encerrada_em?.toISOString() ?? null,
  };
}

export interface PesquisaStatusResponseDto {
  iniciada: boolean;
  pesquisaId: string | null;
  iniciadaEm: string | null;
  gruposSorteados: boolean;
}

export interface SorteioResponseDto {
  alocadosAgora: number;
  controle: number;
  experimental: number;
}

export interface ParticipantesResponseDto {
  consentiram: number;
  recusaram: number;
  controle: number;
  experimental: number;
  semGrupo: number;
  sessoesIniciadas: number;
  sessoesFinalizadas: number;
  susRespondidos: number;
  rtlxRespondidos: number;
}

export interface LinhaExportacaoDto {
  usuarioId: string;
  grupo: Grupo | null;
  ambiente: Ambiente | null;
  sessaoIniciadaEm: string | null;
  sessaoFinalizadaEm: string | null;
  duracaoMinutos: number | null;
  susItens: Record<string, number> | null;
  susPontuacao: string | null;
  rtlxDimensoes: Record<string, number> | null;
  rtlxPontuacao: string | null;
}

export interface ExportacaoResponseDto {
  pesquisa: PesquisaResponseDto;
  participantes: LinhaExportacaoDto[];
}

const MS_POR_MINUTO = 60_000;
const BASE_DECIMAL = 10;
const CASAS_DECIMAIS_DURACAO = 2;
const FATOR_ARREDONDAMENTO = BASE_DECIMAL ** CASAS_DECIMAIS_DURACAO;

export function montarLinhaExportacao(
  consentimento: TcleConsentimento,
  alocacao: AlocacaoGrupo | undefined,
  sessao: SessaoUso | undefined,
  sus: RespostaSus | undefined,
  rtlx: RespostaRtlx | undefined,
): LinhaExportacaoDto {
  const duracaoMinutos =
    sessao?.finalizada_em != null
      ? Math.round(
          ((sessao.finalizada_em.getTime() - sessao.iniciada_em.getTime()) / MS_POR_MINUTO) * FATOR_ARREDONDAMENTO,
        ) / FATOR_ARREDONDAMENTO
      : null;

  return {
    usuarioId: consentimento.usuario_id,
    grupo: alocacao?.grupo ?? null,
    ambiente: sessao?.ambiente ?? null,
    sessaoIniciadaEm: sessao?.iniciada_em.toISOString() ?? null,
    sessaoFinalizadaEm: sessao?.finalizada_em?.toISOString() ?? null,
    duracaoMinutos,
    susItens: (sus?.itens as Record<string, number> | undefined) ?? null,
    susPontuacao: sus?.pontuacao_sus.toString() ?? null,
    rtlxDimensoes: (rtlx?.dimensoes as Record<string, number> | undefined) ?? null,
    rtlxPontuacao: rtlx?.pontuacao_rtlx.toString() ?? null,
  };
}

export interface SessaoResponseDto {
  id: string;
  ambiente: Ambiente;
  iniciadaEm: string;
  finalizadaEm: string | null;
}

export function toSessaoResponseDto(sessao: SessaoUso): SessaoResponseDto {
  return {
    id: sessao.id,
    ambiente: sessao.ambiente,
    iniciadaEm: sessao.iniciada_em.toISOString(),
    finalizadaEm: sessao.finalizada_em?.toISOString() ?? null,
  };
}

export type SituacaoTcle = 'pendente' | 'aceito' | 'recusado';

export interface MinhaParticipacaoResponseDto {
  pesquisa: PesquisaResponseDto | null;
  tcle: SituacaoTcle;
  grupo: Grupo | null;
  ambiente: Ambiente | null;
  sessao: SessaoResponseDto | null;
  susRespondido: boolean;
  rtlxRespondido: boolean;
}

export interface TcleStatusResponseDto {
  consentido: boolean;
  versaoTermo: string;
  respondidoEm: string;
}

export function toTcleStatusResponseDto(consentimento: TcleConsentimento): TcleStatusResponseDto {
  return {
    consentido: consentimento.aceito,
    versaoTermo: consentimento.versao_termo,
    respondidoEm: consentimento.respondido_em.toISOString(),
  };
}

export interface SusResponseDto {
  id: string;
  sessaoId: string;
  pontuacaoSus: string;
}

export function toSusResponseDto(resposta: RespostaSus): SusResponseDto {
  return { id: resposta.id, sessaoId: resposta.sessao_id, pontuacaoSus: resposta.pontuacao_sus.toString() };
}

export interface RtlxResponseDto {
  id: string;
  sessaoId: string;
  pontuacaoRtlx: string;
}

export function toRtlxResponseDto(resposta: RespostaRtlx): RtlxResponseDto {
  return { id: resposta.id, sessaoId: resposta.sessao_id, pontuacaoRtlx: resposta.pontuacao_rtlx.toString() };
}
