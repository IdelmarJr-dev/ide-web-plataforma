import { describe, expect, it } from 'vitest'
import { aplicarFiltro, FILTRO_VAZIO } from '../../../src/features/painel/filtroTurmas'
import type { TurmaDoPainel } from '../../../src/features/painel/types'

function turma(overrides: Partial<TurmaDoPainel> = {}): TurmaDoPainel {
  return {
    id: 't1',
    nome: 'Banco de Dados I',
    disciplina: 'Banco de Dados',
    semestre: '2026.2',
    turno: 'noite',
    sala: 'Lab 2',
    professorId: 'p1',
    codigo: 'ABC123',
    encerradaEm: null,
    criadoEm: '2026-01-01T00:00:00.000Z',
    alunos: 1,
    exercicios: 1,
    entregas: 0,
    aguardandoRevisao: 0,
    ultimaAtividadeEm: null,
    ...overrides,
  }
}

const TURMAS = [
  turma({ id: 't1', turno: 'noite', sala: 'Lab 2' }),
  turma({ id: 't2', nome: 'Tópicos', turno: 'tarde', sala: 'Lab 2' }),
  turma({ id: 't3', nome: 'Sem metadados', turno: null, sala: null }),
]

describe('aplicarFiltro', () => {
  it('sem filtro, devolve tudo', () => {
    expect(aplicarFiltro(TURMAS, FILTRO_VAZIO)).toHaveLength(3)
  })

  it('filtra por turma', () => {
    expect(aplicarFiltro(TURMAS, { ...FILTRO_VAZIO, turmaId: 't2' }).map((t) => t.id)).toEqual(['t2'])
  })

  it('filtra por turno', () => {
    expect(aplicarFiltro(TURMAS, { ...FILTRO_VAZIO, turno: 'noite' }).map((t) => t.id)).toEqual(['t1'])
  })

  it('filtra por sala', () => {
    expect(aplicarFiltro(TURMAS, { ...FILTRO_VAZIO, sala: 'Lab 2' }).map((t) => t.id)).toEqual(['t1', 't2'])
  })

  it('soma os critérios em vez de trocá-los', () => {
    const filtrado = aplicarFiltro(TURMAS, { turmaId: '', turno: 'tarde', sala: 'Lab 2' })

    expect(filtrado.map((t) => t.id)).toEqual(['t2'])
  })

  // Turma sem turno/sala não some quando o professor filtra por outro critério.
  it('exclui turma sem metadado quando o filtro exige aquele metadado', () => {
    expect(aplicarFiltro(TURMAS, { ...FILTRO_VAZIO, turno: 'noite' }).map((t) => t.id)).not.toContain('t3')
  })
})
