import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { RevisaoAluno } from '../../../src/features/painel/components/RevisaoAluno'
import { painelService } from '../../../src/features/painel/services/painelService'
import { exercicioService } from '../../../src/features/exercicio/services/exercicioService'
import type { AtividadeDoAluno, AtividadesDoAluno } from '../../../src/features/painel/types'
import { renderWithProviders } from '../../test-utils'

vi.mock('../../../src/features/painel/services/painelService', () => ({
  painelService: { atividadesDoAluno: vi.fn(), liberarEnvio: vi.fn(), doProfessor: vi.fn(), doAluno: vi.fn(), daTurma: vi.fn() },
}))

vi.mock('../../../src/features/exercicio/services/exercicioService', () => ({
  exercicioService: { respostasDoAluno: vi.fn(), revisarResultado: vi.fn() },
}))

const TURMA = {
  id: 't1',
  nome: 'Banco de Dados I',
  disciplina: 'Banco de Dados',
  semestre: '2026.2',
  turno: null,
  sala: null,
  professorId: 'p1',
  codigo: 'ABC123',
  encerradaEm: null,
  criadoEm: '2026-01-01T00:00:00.000Z',
}

function atividade(overrides: Partial<AtividadeDoAluno> = {}): AtividadeDoAluno {
  return {
    id: 'e1',
    titulo: 'Liste os clientes',
    temSql: true,
    temMer: false,
    temDissertativa: false,
    estado: 'correto',
    tentativas: 2,
    dicas: 0,
    finalizadoEm: null,
    sqlCorreto: true,
    merAvaliacao: null,
    dissertativaAvaliacao: null,
    pontuacao: null,
    revisado: false,
    envioLiberadoEm: null,
    ultimoEnvioComErro: false,
    ...overrides,
  } as AtividadeDoAluno
}

function dados(overrides: Partial<AtividadesDoAluno> = {}): AtividadesDoAluno {
  return {
    aluno: { id: 'a1', nome: 'Maria Souza', email: 'maria@teste.com' },
    turma: TURMA,
    atividades: [atividade()],
    ...overrides,
  }
}

function renderTela(): void {
  renderWithProviders(
    <Routes>
      <Route path="/admin/turmas/:turmaId/alunos/:usuarioId" element={<RevisaoAluno />} />
    </Routes>,
    { route: '/admin/turmas/t1/alunos/a1' },
  )
}

describe('RevisaoAluno', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(exercicioService.respostasDoAluno).mockResolvedValue({ ultimaSubmissaoSql: null, dissertativa: null })
  })

  // Fase 10, D4: o professor corrige a pessoa, vendo tudo o que ela tem na turma.
  it('lista todas as atividades do aluno numa tela só', async () => {
    vi.mocked(painelService.atividadesDoAluno).mockResolvedValue(
      dados({
        atividades: [
          atividade({ id: 'e1', titulo: 'Liste os clientes', estado: 'correto' }),
          atividade({ id: 'e2', titulo: 'Modele biblioteca', estado: 'aguardando_revisao', temSql: false, temMer: true }),
        ],
      }),
    )

    renderTela()

    expect(await screen.findByRole('heading', { name: 'Maria Souza' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Liste os clientes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Modele biblioteca' })).toBeInTheDocument()
  })

  // Fase 10, item 1: sair da tela não pode depender do botão do navegador.
  it('oferece voltar ao painel e voltar à turma', async () => {
    vi.mocked(painelService.atividadesDoAluno).mockResolvedValue(dados())

    renderTela()

    expect(await screen.findByRole('link', { name: /voltar ao painel/i })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: /voltar à turma/i })).toHaveAttribute('href', '/admin/turmas/t1/painel')
  })

  // Fase 10, D6: a escala do IFPI é 0 a 10.
  it('pede a nota na escala de 0 a 10', async () => {
    vi.mocked(painelService.atividadesDoAluno).mockResolvedValue(dados())

    renderTela()

    const campo = await screen.findByLabelText(/nota final/i)
    expect(campo).toHaveAttribute('max', '10')
  })

  // Fase 10, D10: o envio queimado sem executar é decisão do professor.
  it('avisa sobre envio que morreu em erro de sintaxe e oferece liberar outro', async () => {
    vi.mocked(painelService.atividadesDoAluno).mockResolvedValue(
      dados({ atividades: [atividade({ ultimoEnvioComErro: true })] }),
    )
    vi.mocked(painelService.liberarEnvio).mockResolvedValue({ liberado: true })

    renderTela()
    const user = userEvent.setup()

    expect(await screen.findByText(/nem chegou a executar/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /liberar novo envio/i }))

    expect(painelService.liberarEnvio).toHaveBeenCalledWith('e1', 'a1')
  })

  it('avisa quando o aluno não entregou nada, sem esconder os campos de nota', async () => {
    vi.mocked(painelService.atividadesDoAluno).mockResolvedValue(
      dados({ atividades: [atividade({ estado: 'nao_iniciou', sqlCorreto: null, tentativas: 0 })] }),
    )

    renderTela()

    expect(await screen.findByText(/não enviou nada nesta atividade/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /salvar nota/i })).toBeInTheDocument()
  })
})
