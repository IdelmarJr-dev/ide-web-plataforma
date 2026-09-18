import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { MatrizTurma } from '../../../src/features/painel/components/MatrizTurma'
import { painelService } from '../../../src/features/painel/services/painelService'
import type { CelulaMatriz, PainelTurma } from '../../../src/features/painel/types'
import { renderWithProviders } from '../../test-utils'

vi.mock('../../../src/features/painel/services/painelService', () => ({
  painelService: { doProfessor: vi.fn(), doAluno: vi.fn(), daTurma: vi.fn() },
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

function celula(overrides: Partial<CelulaMatriz> = {}): CelulaMatriz {
  return {
    alunoId: 'a1',
    exercicioId: 'e1',
    estado: 'nao_iniciou',
    tentativas: 0,
    dicas: 0,
    finalizadoEm: null,
    pontuacao: null,
    ultimoEnvioComErro: false,
    ...overrides,
  }
}

function painel(overrides: Partial<PainelTurma> = {}): PainelTurma {
  return {
    turma: TURMA,
    exercicios: [{ id: 'e1', titulo: 'Liste os clientes' }, { id: 'e2', titulo: 'Conte os pedidos' }] as never,
    alunos: [
      { id: 'a1', nome: 'Ana', email: 'ana@teste.com', provaId: null },
      { id: 'a2', nome: 'Bia', email: 'bia@teste.com', provaId: 'prova-b' },
    ],
    celulas: [celula(), celula({ exercicioId: 'e2' }), celula({ alunoId: 'a2', estado: 'correto' })],
    dificuldade: [
      { exercicioId: 'e1', taxaAcerto: 0.5, mediaTentativas: 2, dicasPorAluno: 1 },
      { exercicioId: 'e2', taxaAcerto: null, mediaTentativas: null, dicasPorAluno: 0 },
    ],
    ...overrides,
  }
}

function renderMatriz(): void {
  renderWithProviders(
    <Routes>
      <Route path="/admin/turmas/:turmaId/painel" element={<MatrizTurma />} />
    </Routes>,
    { route: '/admin/turmas/t1/painel' },
  )
}

describe('MatrizTurma', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('monta uma tabela com um aluno por linha e um exercício por coluna', async () => {
    vi.mocked(painelService.daTurma).mockResolvedValue(painel())

    renderMatriz()

    const tabela = await screen.findByRole('table', { name: /situação de cada aluno/i })
    expect(within(tabela).getByRole('columnheader', { name: 'Liste os clientes' })).toBeInTheDocument()
    expect(within(tabela).getByRole('rowheader', { name: 'Ana' })).toBeInTheDocument()
    expect(within(tabela).getByRole('rowheader', { name: 'Bia' })).toBeInTheDocument()
  })

  // Fase 9, D10: o estado precisa existir como texto, não só como cor.
  it('anuncia o estado de cada célula em texto e leva à revisão do aluno', async () => {
    vi.mocked(painelService.daTurma).mockResolvedValue(painel())

    renderMatriz()

    const link = await screen.findByRole('link', { name: /ana em liste os clientes: não iniciou/i })
    // Fase 10, D4: a célula leva à revisão do ALUNO, com todas as atividades dele.
    expect(link).toHaveAttribute('href', '/admin/turmas/t1/alunos/a1')
  })

  // Fase 9, D3: a Bia foi sorteada com outra prova e não tem célula em e2.
  it('marca como fora da prova o par sem célula, em vez de fingir "não iniciou"', async () => {
    vi.mocked(painelService.daTurma).mockResolvedValue(painel())

    renderMatriz()

    expect(await screen.findByText(/não faz parte da prova deste aluno/i)).toBeInTheDocument()
  })

  it('mostra "sem dados" no exercício que ninguém tentou, em vez de 0%', async () => {
    vi.mocked(painelService.daTurma).mockResolvedValue(painel())

    renderMatriz()

    expect(await screen.findByText('Onde a turma trava')).toBeInTheDocument()
    expect(screen.getAllByText('sem dados').length).toBeGreaterThan(0)
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('avisa quando a turma ainda não tem aluno matriculado', async () => {
    vi.mocked(painelService.daTurma).mockResolvedValue(painel({ alunos: [], celulas: [] }))

    renderMatriz()

    expect(await screen.findByText(/nenhum aluno se matriculou/i)).toBeInTheDocument()
  })
  // Fase 10, item 4: a nota aparece na própria célula.
  it('mostra a nota lançada dentro da célula', async () => {
    vi.mocked(painelService.daTurma).mockResolvedValue(
      painel({ celulas: [celula({ estado: 'correto', pontuacao: 8.5 })] }),
    )

    renderMatriz()

    expect(await screen.findByText('8,5')).toBeInTheDocument()
  })

  // Fase 10, D10: o professor precisa ver de longe qual envio morreu sem executar.
  it('marca a célula cujo último envio não executou', async () => {
    vi.mocked(painelService.daTurma).mockResolvedValue(
      painel({ celulas: [celula({ estado: 'entregue', ultimoEnvioComErro: true })] }),
    )

    renderMatriz()

    expect(await screen.findByRole('link', { name: /último envio não executou/i })).toBeInTheDocument()
  })
})
