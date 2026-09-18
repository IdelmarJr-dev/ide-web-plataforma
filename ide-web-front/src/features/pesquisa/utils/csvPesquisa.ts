import type { AcertosTarefa, Exportacao } from '../types'
import { RTLX_DIMENSOES } from './rtlxScore'

/**
 * CSV da pesquisa pra análise estatística fora do sistema (R, pandas, JASP). Junta a
 * exportação do backend Python (grupo, sessão, SUS, RTLX) com os acertos do Node,
 * pelo `usuario_id` — que NUNCA vai pro arquivo: vira P01, P02… na ordem de
 * consentimento. Sem nome, sem IP. Ver docs/decisions/fase6-alinhamento-tcc.md.
 */

const SEPARADOR = ','
const QUEBRA_LINHA = '\r\n'
const BOM = '﻿'
const QUANTIDADE_ITENS_SUS = 10
const DIGITOS_PARTICIPANTE = 2

const SUFIXOS_RTLX: Record<string, string> = {
  demandaMental: 'mental',
  demandaFisica: 'fisica',
  demandaTemporal: 'temporal',
  desempenho: 'desempenho',
  esforco: 'esforco',
  frustracao: 'frustracao',
}

type Celula = string | number | null | undefined

function escapar(valor: Celula): string {
  if (valor === null || valor === undefined) return ''
  const texto = String(valor)
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

function codigoParticipante(indice: number): string {
  return `P${String(indice + 1).padStart(DIGITOS_PARTICIPANTE, '0')}`
}

function corretaParaNumero(correta: boolean | null | undefined): Celula {
  if (correta === null || correta === undefined) return null
  return correta ? 1 : 0
}

export function montarCsvPesquisa(exportacao: Exportacao, acertos: AcertosTarefa | null): string {
  const exercicioIds = exportacao.pesquisa.exercicioIds
  const acertosPorAluno = new Map(acertos?.alunos.map((aluno) => [aluno.usuarioId, aluno.exercicios]) ?? [])

  const cabecalho = [
    'participante',
    'grupo',
    'ambiente',
    'duracao_min',
    ...Array.from({ length: QUANTIDADE_ITENS_SUS }, (_, indice) => `sus_q${String(indice + 1)}`),
    'sus_total',
    ...RTLX_DIMENSOES.map((dimensao) => `rtlx_${SUFIXOS_RTLX[dimensao.chave] ?? dimensao.chave}`),
    'rtlx_total',
    ...exercicioIds.flatMap((_, indice) => {
      const prefixo = `ex${String(indice + 1)}`
      return [`${prefixo}_correta`, `${prefixo}_tentativas`, `${prefixo}_dicas_sql`, `${prefixo}_dicas_mer`]
    }),
  ]

  const linhas = exportacao.participantes.map((participante, indice) => {
    const exerciciosDoAluno = acertosPorAluno.get(participante.usuarioId) ?? []
    const celulas: Celula[] = [
      codigoParticipante(indice),
      participante.grupo,
      participante.ambiente,
      participante.duracaoMinutos,
      ...Array.from({ length: QUANTIDADE_ITENS_SUS }, (_, item) => participante.susItens?.[String(item + 1)]),
      participante.susPontuacao,
      ...RTLX_DIMENSOES.map((dimensao) => participante.rtlxDimensoes?.[dimensao.chave]),
      participante.rtlxPontuacao,
      ...exercicioIds.flatMap((exercicioId) => {
        const acerto = exerciciosDoAluno.find((exercicio) => exercicio.exercicioId === exercicioId)
        return [corretaParaNumero(acerto?.correta), acerto?.tentativas, acerto?.dicasSql, acerto?.dicasMer]
      }),
    ]
    return celulas.map(escapar).join(SEPARADOR)
  })

  return BOM + [cabecalho.join(SEPARADOR), ...linhas].join(QUEBRA_LINHA) + QUEBRA_LINHA
}
