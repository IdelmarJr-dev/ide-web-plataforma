import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { PainelAluno } from '../../../src/features/painel/components/PainelAluno'
import { painelService } from '../../../src/features/painel/services/painelService'
import type { ExercicioDoAluno, PainelAluno as PainelAlunoDados } from '../../../src/features/painel/types'
import { renderWithProviders } from '../../test-utils'

vi.mock('../../../src/features/painel/services/painelService', () => ({
  painelService: { doProfessor: vi.fn(), doAluno: vi.fn(), daTurma: vi.fn() },
}))

// O banner de pesquisa é o gatilho da coleta; aqui só precisa estar presente e primeiro.
vi.mock('../../../src/features/pesquisa/components/PesquisaBanner', () => ({
  PesquisaBanner: () => <div data-testid="pesquisa-banner" />,
}))

const TURMA = {
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
}

function exercicio(overrides: Partial<ExercicioDoAluno> = {}): ExercicioDoAluno {
  return {
    id: 'e1',
    titulo: 'Liste os clientes',
    nivelDificuldade: 'iniciante',
    estado: 'nao_iniciou',
    turmaId: 't1',
    turmaNome: 'Turma A',
    disciplina: 'Banco de Dados',
    gabaritoLiberado: false,
    finalizadoEm: null,
    ...overrides,
  } as ExercicioDoAluno
}

function painel(overrides: Partial<PainelAlunoDados> = {}): PainelAlunoDados {
  return {
    resumo: { turmas: 1, pendentes: 1, entregues: 0, acertos: 0 },
    disciplinas: [{ disciplina: 'Banco de Dados', turmas: [{ ...TURMA, exercicios: [exercicio()] }] }],
    pendencias: [exercicio()],
    historico: [],
    progresso: { porTurma: [], tentativasAteAcertar: [] },
    ...overrides,
  }
}

describe('PainelAluno', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
  })

  // Fase 9, D7: o banner tem que continuar sendo o primeiro elemento da tela do aluno.
  it('mantém o banner de pesquisa no topo', async () => {
    vi.mocked(painelService.doAluno).mockResolvedValue(painel())

    const { container } = renderWithProviders(<PainelAluno />)

    expect(await screen.findByTestId('pesquisa-banner')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="pesquisa-banner"]')).toBe(container.firstChild?.firstChild)
  })

  it('agrupa as turmas por disciplina', async () => {
    vi.mocked(painelService.doAluno).mockResolvedValue(
      painel({
        disciplinas: [
          { disciplina: 'Banco de Dados', turmas: [{ ...TURMA, exercicios: [exercicio()] }] },
          {
            disciplina: 'Engenharia de Software',
            turmas: [{ ...TURMA, id: 't2', nome: 'Turma B', exercicios: [] }],
          },
        ],
      }),
    )

    renderWithProviders(<PainelAluno />)

    expect(await screen.findByRole('heading', { name: 'Banco de Dados' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Engenharia de Software' })).toBeInTheDocument()
  })

  it('reúne o que falta fazer de todas as turmas num lugar só', async () => {
    vi.mocked(painelService.doAluno).mockResolvedValue(painel())

    renderWithProviders(<PainelAluno />)

    expect(await screen.findByText('O que falta fazer')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Liste os clientes' }).length).toBeGreaterThan(0)
  })

  it('diz que está em dia quando não há pendência', async () => {
    vi.mocked(painelService.doAluno).mockResolvedValue(
      painel({ pendencias: [], resumo: { turmas: 1, pendentes: 0, entregues: 1, acertos: 1 } }),
    )

    renderWithProviders(<PainelAluno />)

    expect(await screen.findByText(/em dia com todas as turmas/i)).toBeInTheDocument()
  })

  // Fase 9, D6: nada de colega — nem nome, nem média, nem posição.
  it('mostra o progresso como comparação do aluno com ele mesmo', async () => {
    vi.mocked(painelService.doAluno).mockResolvedValue(
      painel({
        progresso: {
          porTurma: [],
          tentativasAteAcertar: [{ exercicioId: 'e1', titulo: 'Liste os clientes', tentativas: 3 }],
        },
      }),
    )

    renderWithProviders(<PainelAluno />)

    expect(await screen.findByText('Seu progresso')).toBeInTheDocument()
    expect(screen.getByText(/acertou na/i)).toBeInTheDocument()
    expect(screen.getByText('3ª tentativa')).toBeInTheDocument()
    expect(screen.queryByText(/média da turma|posição|ranking/i)).not.toBeInTheDocument()
  })
})
