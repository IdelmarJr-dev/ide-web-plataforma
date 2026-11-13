import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SandboxPainel } from '../../../src/features/exercicio/components/SandboxPainel'
import { renderWithProviders } from '../../test-utils'

/** O AuthProvider chama /auth/me ao montar; o que importa aqui é o envio. */
function houveEnvio(): boolean {
  return vi.mocked(fetch).mock.calls.some((chamada) => String(chamada[0]).includes('/sandbox/enviar'))
}

describe('SandboxPainel em questão de prova', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { status: 'sucesso', rows: [], correta: null } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // Fase 10, D9: testar livremente transformaria a prova num exercício comum.
  it('não oferece "Testar" quando o exercício é de prova', () => {
    renderWithProviders(<SandboxPainel exercicioId="e1" sql="SELECT 1" ehProva />)

    expect(screen.queryByRole('button', { name: 'Testar' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enviar resposta/i })).toBeInTheDocument()
  })

  it('oferece "Testar" fora de prova', () => {
    renderWithProviders(<SandboxPainel exercicioId="e1" sql="SELECT 1" />)

    expect(screen.getByRole('button', { name: 'Testar' })).toBeInTheDocument()
  })

  it('avisa na tela que a questão é de prova', () => {
    renderWithProviders(<SandboxPainel exercicioId="e1" sql="SELECT 1" ehProva />)

    expect(screen.getByText(/você não pode testar a consulta, e o envio é único/i)).toBeInTheDocument()
  })

  // Fase 10, D10: o envio consome a tentativa mesmo se falhar.
  it('pede confirmação antes do envio único, dizendo que não dá para corrigir', async () => {
    renderWithProviders(<SandboxPainel exercicioId="e1" sql="SELECT 1" ehProva />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /enviar resposta/i }))

    expect(await screen.findByRole('heading', { name: /enviar esta resposta/i })).toBeInTheDocument()
    expect(screen.getByText(/um único envio/i)).toBeInTheDocument()
    expect(houveEnvio()).toBe(false)
  })

  it('envia de fato só depois de confirmar', async () => {
    renderWithProviders(<SandboxPainel exercicioId="e1" sql="SELECT 1" ehProva />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /enviar resposta/i }))
    await user.click(await screen.findByRole('button', { name: /enviar definitivamente/i }))

    expect(houveEnvio()).toBe(true)
  })

  it('não envia quando o aluno escolhe revisar mais', async () => {
    renderWithProviders(<SandboxPainel exercicioId="e1" sql="SELECT 1" ehProva />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /enviar resposta/i }))
    await user.click(await screen.findByRole('button', { name: /revisar mais/i }))

    expect(houveEnvio()).toBe(false)
  })

  it('fora de prova, envia direto sem confirmação', async () => {
    renderWithProviders(<SandboxPainel exercicioId="e1" sql="SELECT 1" />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /enviar resposta/i }))

    expect(houveEnvio()).toBe(true)
  })

  it('depois do envio da prova, trava o botão e diz como conseguir outro envio', async () => {
    renderWithProviders(<SandboxPainel exercicioId="e1" sql="SELECT 1" ehProva />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /enviar resposta/i }))
    await user.click(await screen.findByRole('button', { name: /enviar definitivamente/i }))

    expect(await screen.findByText(/peça ao professor para liberar um novo envio/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enviar resposta/i })).toBeDisabled()
  })
})

describe('SandboxPainel quando o servidor recusa ou não responde', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // Antes, a recusa (prazo, turma encerrada, envio único já usado) não aparecia na tela.
  it('mostra a regra que o servidor usou para recusar o envio', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ error: { code: 'FORBIDDEN', message: 'O prazo desta atividade encerrou em 31/12/2026 23:59' } }),
            { status: 403, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      ),
    )
    renderWithProviders(<SandboxPainel exercicioId="e1" sql="SELECT 1" />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /enviar resposta/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('O prazo desta atividade encerrou em 31/12/2026 23:59.')
  })

  it('distingue falta de conexão de recusa do servidor', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    renderWithProviders(<SandboxPainel exercicioId="e1" sql="SELECT 1" />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Testar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/sem conexão com o servidor/i)
  })
})
