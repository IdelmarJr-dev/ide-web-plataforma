import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { RevisaoAlunoPage } from '../../../src/features/exercicio/components/RevisaoAlunoPage'
import { exercicioService } from '../../../src/features/exercicio/services/exercicioService'
import { renderWithProviders } from '../../test-utils'

// A modelagem tem componente próprio e canvas pesado; aqui o foco é D17 (SQL e dissertativa).
vi.mock('../../../src/features/exercicio/components/modelagem/RevisaoModelagem', () => ({
  RevisaoModelagem: () => <div data-testid="revisao-modelagem" />,
}))

vi.mock('../../../src/features/exercicio/services/exercicioService', () => ({
  exercicioService: {
    buscarPorId: vi.fn(),
    resultadoDoAluno: vi.fn(),
    respostasDoAluno: vi.fn(),
    revisarResultado: vi.fn(),
  },
}))

const serviceMock = vi.mocked(exercicioService)

function renderPagina(): void {
  renderWithProviders(
    <Routes>
      <Route path="/revisar/:exercicioId/:usuarioId" element={<RevisaoAlunoPage />} />
    </Routes>,
    { route: '/revisar/exercicio-1/aluno-1' },
  )
}

describe('RevisaoAlunoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMock.buscarPorId.mockResolvedValue({
      id: 'exercicio-1',
      titulo: 'Liste os clientes',
      temSql: true,
      temMer: false,
      temDissertativa: true,
      modoMer: 'conceitual_logico',
    } as never)
    serviceMock.resultadoDoAluno.mockResolvedValue(null)
  })

  // Fase 9, D17: a tela só tinha campos de nota — o professor corrigia sem ver a resposta.
  it('mostra a última consulta enviada com o veredito automático', async () => {
    serviceMock.respostasDoAluno.mockResolvedValue({
      ultimaSubmissaoSql: { query: 'SELECT nome FROM clientes', correta: false, criadoEm: '2026-01-03T00:00:00.000Z' },
      dissertativa: { texto: 'Usei LEFT JOIN porque...', atualizadoEm: '2026-01-03T01:00:00.000Z' },
    })

    renderPagina()

    expect(await screen.findByText('SELECT nome FROM clientes')).toBeInTheDocument()
    expect(screen.getByText('incorreta pelo gabarito')).toBeInTheDocument()
    expect(screen.getByText('Usei LEFT JOIN porque...')).toBeInTheDocument()
  })

  it('diz que não há gabarito em vez de fingir um veredito', async () => {
    serviceMock.respostasDoAluno.mockResolvedValue({
      ultimaSubmissaoSql: { query: 'SELECT 1', correta: null, criadoEm: '2026-01-03T00:00:00.000Z' },
      dissertativa: null,
    })

    renderPagina()

    expect(await screen.findByText('sem gabarito para conferir automaticamente')).toBeInTheDocument()
  })

  // Fase 9, D16: avisa, mas não bloqueia — registrar um zero é decisão do professor.
  it('avisa quando o aluno não entregou nada, sem esconder o formulário de nota', async () => {
    serviceMock.respostasDoAluno.mockResolvedValue({ ultimaSubmissaoSql: null, dissertativa: null })

    renderPagina()

    expect(await screen.findByText(/não enviou nada neste exercício/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /salvar revisão/i })).toBeInTheDocument()
  })
})
