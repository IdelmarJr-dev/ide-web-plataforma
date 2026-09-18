import { describe, expect, it } from 'vitest'
import type { AcertosTarefa, Exportacao } from '../../../src/features/pesquisa/types'
import { montarCsvPesquisa } from '../../../src/features/pesquisa/utils/csvPesquisa'

const USUARIO_A = '11111111-1111-1111-1111-111111111111'
const USUARIO_B = '22222222-2222-2222-2222-222222222222'

const EXPORTACAO: Exportacao = {
  pesquisa: {
    id: 'p1',
    turmaId: 't1',
    exercicioIds: ['ex-1', 'ex-2'],
    iniciadaEm: '2026-09-14T10:00:00Z',
    gruposSorteadosEm: null,
    encerradaEm: null,
  },
  participantes: [
    {
      usuarioId: USUARIO_A,
      grupo: 'experimental',
      ambiente: 'ide_web',
      sessaoIniciadaEm: '2026-09-14T10:10:00Z',
      sessaoFinalizadaEm: '2026-09-14T11:00:00Z',
      duracaoMinutos: 50,
      susItens: { '1': 5, '2': 1, '3': 5, '4': 1, '5': 5, '6': 1, '7': 5, '8': 1, '9': 5, '10': 1 },
      susPontuacao: '100.00',
      rtlxDimensoes: { demandaMental: 50, demandaFisica: 0, demandaTemporal: 40, desempenho: 10, esforco: 60, frustracao: 20 },
      rtlxPontuacao: '30.00',
    },
    {
      usuarioId: USUARIO_B,
      grupo: 'controle',
      ambiente: null,
      sessaoIniciadaEm: null,
      sessaoFinalizadaEm: null,
      duracaoMinutos: null,
      susItens: null,
      susPontuacao: null,
      rtlxDimensoes: null,
      rtlxPontuacao: null,
    },
  ],
}

const ACERTOS: AcertosTarefa = {
  turmaId: 't1',
  exercicioIds: ['ex-1', 'ex-2'],
  alunos: [
    {
      usuarioId: USUARIO_A,
      exercicios: [
        { exercicioId: 'ex-1', tentativas: 3, correta: true, dicasSql: 2, dicasMer: 1 },
        { exercicioId: 'ex-2', tentativas: 1, correta: false, dicasSql: 0, dicasMer: 0 },
      ],
    },
  ],
}

function linhas(csv: string): string[] {
  return csv.replace(/^\uFEFF/, '').trimEnd().split('\r\n')
}

describe('montarCsvPesquisa', () => {
  it('troca o usuario_id por P01, P02… e nunca inclui o UUID', () => {
    const csv = montarCsvPesquisa(EXPORTACAO, ACERTOS)

    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).not.toContain(USUARIO_A)
    expect(csv).not.toContain(USUARIO_B)
    expect(linhas(csv)[1]?.startsWith('P01,experimental,ide_web,50,')).toBe(true)
    expect(linhas(csv)[2]?.startsWith('P02,controle,')).toBe(true)
  })

  it('tem as colunas de SUS, RTLX e acertos por exercício', () => {
    const [cabecalho, primeira] = linhas(montarCsvPesquisa(EXPORTACAO, ACERTOS))

    expect(cabecalho).toBe(
      'participante,grupo,ambiente,duracao_min,sus_q1,sus_q2,sus_q3,sus_q4,sus_q5,sus_q6,sus_q7,sus_q8,sus_q9,sus_q10,' +
        'sus_total,rtlx_mental,rtlx_fisica,rtlx_temporal,rtlx_desempenho,rtlx_esforco,rtlx_frustracao,rtlx_total,' +
        'ex1_correta,ex1_tentativas,ex1_dicas_sql,ex1_dicas_mer,ex2_correta,ex2_tentativas,ex2_dicas_sql,ex2_dicas_mer',
    )
    expect(primeira).toBe('P01,experimental,ide_web,50,5,1,5,1,5,1,5,1,5,1,100.00,50,0,40,10,60,20,30.00,1,3,2,1,0,1,0,0')
  })

  it('deixa vazio o que o participante não fez', () => {
    const [, , segunda] = linhas(montarCsvPesquisa(EXPORTACAO, ACERTOS))

    expect(segunda).toBe('P02,controle' + ','.repeat(28))
  })
})
