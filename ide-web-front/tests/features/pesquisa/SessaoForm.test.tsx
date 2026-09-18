import { afterEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessaoForm } from '../../../src/features/pesquisa/components/SessaoForm'
import { renderWithProviders } from '../../test-utils'
import { mockFetchPesquisa, participacao } from './pesquisaFetchMock'

const EXERCICIO = {
  id: 'ex-1',
  turmaId: 'turma-1',
  provaId: null,
  titulo: 'Clientes e pedidos',
  enunciado: 'Liste os pedidos de cada cliente.',
  nivelDificuldade: 'iniciante',
  ordem: 1,
  gabaritoLiberado: false,
  temSql: true,
  temMer: false,
  temDissertativa: false,
  sqlSetup: 'CREATE TABLE cliente (id INT);',
  criadoEm: '2026-09-01T00:00:00Z',
}

const MINHA = 'GET /pesquisa/minha-participacao'

describe('SessaoForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pede o TCLE quando o aluno ainda não aceitou', async () => {
    mockFetchPesquisa({ [MINHA]: participacao({ tcle: 'pendente', grupo: null, ambiente: null }) })

    renderWithProviders(<SessaoForm />)

    expect(await screen.findByText(/primeiro leia e aceite o termo/i)).toBeInTheDocument()
  })

  it('aguarda o sorteio quando o aluno aceitou mas ainda não tem grupo', async () => {
    mockFetchPesquisa({ [MINHA]: participacao({ grupo: null, ambiente: null }) })

    renderWithProviders(<SessaoForm />)

    expect(await screen.findByText(/aguarde o pesquisador sortear os grupos/i)).toBeInTheDocument()
  })

  it('mostra o ambiente sorteado e inicia a tarefa sem mandar ambiente pelo cliente', async () => {
    const chamadas = mockFetchPesquisa({
      [MINHA]: participacao({ grupo: 'controle', ambiente: 'ferramentas_tradicionais' }),
      'POST /sessoes/iniciar': { id: 's1', ambiente: 'ferramentas_tradicionais', iniciadaEm: '2026-09-14T10:10:00Z', finalizadaEm: null },
    })

    renderWithProviders(<SessaoForm />)

    expect(await screen.findByText(/ferramentas tradicionais da disciplina/i)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /iniciar tarefa/i }))

    await waitFor(() => {
      const inicio = chamadas.find((chamada) => chamada.caminho === '/sessoes/iniciar')
      expect(inicio).toBeDefined()
      expect(inicio?.corpo).toBeUndefined()
    })
  })

  it('grupo experimental vê os exercícios da tarefa como links para a IDE', async () => {
    mockFetchPesquisa({
      [MINHA]: participacao({ sessao: { id: 's1', iniciadaEm: '2026-09-14T10:10:00Z', finalizadaEm: null } }),
      'GET /turmas/turma-1/exercicios': [EXERCICIO],
    })

    renderWithProviders(<SessaoForm />)

    const link = await screen.findByRole('link', { name: /clientes e pedidos — abrir na ide web/i })
    expect(link).toHaveAttribute('href', '/exercicios/ex-1')
    expect(screen.getByText(/tempo de tarefa/i)).toBeInTheDocument()
  })

  it('grupo controle entrega a consulta e não vê se acertou', async () => {
    const chamadas = mockFetchPesquisa({
      [MINHA]: participacao({
        grupo: 'controle',
        ambiente: 'ferramentas_tradicionais',
        sessao: { id: 's1', iniciadaEm: '2026-09-14T10:10:00Z', finalizadaEm: null },
      }),
      'GET /turmas/turma-1/exercicios': [EXERCICIO],
      'POST /exercicios/ex-1/sandbox/enviar': { status: 'sucesso', rows: [], correta: true, submissaoId: 'sub', tentativaNumero: 1, plano: null },
    })
    const user = userEvent.setup()

    renderWithProviders(<SessaoForm />)

    await user.type(await screen.findByLabelText(/cole sua consulta sql final/i), 'SELECT * FROM cliente')
    await user.click(screen.getByRole('button', { name: /entregar consulta/i }))

    expect(await screen.findByText('Resposta registrada.')).toBeInTheDocument()
    expect(screen.queryByText(/correta/i)).not.toBeInTheDocument()
    expect(chamadas.find((chamada) => chamada.caminho === '/exercicios/ex-1/sandbox/enviar')?.corpo).toEqual({
      sql: 'SELECT * FROM cliente',
    })
    localStorage.clear()
  })

  it('pede confirmação antes de finalizar a tarefa', async () => {
    mockFetchPesquisa({
      [MINHA]: participacao({ sessao: { id: 's1', iniciadaEm: '2026-09-14T10:10:00Z', finalizadaEm: null } }),
      'GET /turmas/turma-1/exercicios': [EXERCICIO],
    })
    const user = userEvent.setup()

    renderWithProviders(<SessaoForm />)

    await user.click(await screen.findByRole('button', { name: /terminei — finalizar tarefa/i }))
    expect(screen.getByText(/depois disso não dá para voltar/i)).toBeInTheDocument()
  })

  it('leva ao SUS depois de finalizar', async () => {
    mockFetchPesquisa({
      [MINHA]: participacao({
        sessao: { id: 's1', iniciadaEm: '2026-09-14T10:10:00Z', finalizadaEm: '2026-09-14T11:00:00Z' },
      }),
    })

    renderWithProviders(<SessaoForm />)

    expect(await screen.findByRole('link', { name: /questionário de usabilidade \(sus\)/i })).toHaveAttribute(
      'href',
      '/pesquisa/sus',
    )
  })
})
