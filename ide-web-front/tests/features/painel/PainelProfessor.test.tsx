import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { PainelProfessor } from '../../../src/features/painel/components/PainelProfessor'
import { painelService } from '../../../src/features/painel/services/painelService'
import type { PainelProfessor as PainelProfessorDados, TurmaDoPainel } from '../../../src/features/painel/types'
import { renderWithProviders } from '../../test-utils'

vi.mock('../../../src/features/painel/services/painelService', () => ({
  painelService: { doProfessor: vi.fn(), doAluno: vi.fn(), daTurma: vi.fn() },
}))

function turma(overrides: Partial<TurmaDoPainel> = {}): TurmaDoPainel {
  return {
    id: 't1',
    nome: 'Turma A',
    disciplina: 'Banco de Dados',
    semestre: '2026.2',
  turno: null,
  sala: null,
    professorId: 'p1',
    codigo: 'ABC123',
    encerradaEm: null,
    criadoEm: '2026-01-01T00:00:00.000Z',
    alunos: 2,
    exercicios: 2,
    entregas: 1,
    aguardandoRevisao: 0,
    ultimaAtividadeEm: null,
    ...overrides,
  }
}

function painel(overrides: Partial<PainelProfessorDados> = {}): PainelProfessorDados {
  return {
    resumo: { turmasAtivas: 1, turmasEncerradas: 0, alunos: 2, exercicios: 2, aguardandoRevisao: 0 },
    turmas: [turma()],
    ...overrides,
  }
}

describe('PainelProfessor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mostra os números do resumo e a turma', async () => {
    vi.mocked(painelService.doProfessor).mockResolvedValue(painel())

    renderWithProviders(<PainelProfessor />)

    expect(await screen.findByText('Turma A')).toBeInTheDocument()
    expect(screen.getByText('Turmas ativas')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver a matriz da turma/i })).toHaveAttribute(
      'href',
      '/admin/turmas/t1/painel',
    )
  })

  it('leva o professor sem turma a criar a primeira, em vez de mostrar tela vazia', async () => {
    vi.mocked(painelService.doProfessor).mockResolvedValue(
      painel({ resumo: { turmasAtivas: 0, turmasEncerradas: 0, alunos: 0, exercicios: 0, aguardandoRevisao: 0 }, turmas: [] }),
    )

    renderWithProviders(<PainelProfessor />)

    expect(await screen.findByText(/você ainda não tem turmas/i)).toBeInTheDocument()
  })

  // Fase 9, D4: a fila é só do que exige humano.
  it('diz que não há nada a corrigir quando nenhuma turma tem pendência', async () => {
    vi.mocked(painelService.doProfessor).mockResolvedValue(painel())

    renderWithProviders(<PainelProfessor />)

    expect(await screen.findByText(/nada aguardando correção manual/i)).toBeInTheDocument()
  })

  it('lista na fila a turma com entrega esperando correção', async () => {
    vi.mocked(painelService.doProfessor).mockResolvedValue(
      painel({
        resumo: { turmasAtivas: 1, turmasEncerradas: 0, alunos: 2, exercicios: 2, aguardandoRevisao: 3 },
        turmas: [turma({ aguardandoRevisao: 3 })],
      }),
    )

    renderWithProviders(<PainelProfessor />)

    expect(await screen.findByRole('link', { name: /corrigir/i })).toHaveAttribute('href', '/admin/turmas/t1/painel')
    expect(screen.getByText('3 entregas')).toBeInTheDocument()
  })
})
