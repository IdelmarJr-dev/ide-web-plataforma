import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PedirDicaButton } from '../../../src/features/dica-ia'
import { renderWithProviders } from '../../test-utils'

function respostaAuthNaoAutenticado(): Response {
  return new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Autenticação necessária' } }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('PedirDicaButton', () => {
  let resolverPedidoDica: ((response: Response) => void) | null

  beforeEach(() => {
    resolverPedidoDica = null

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/exercicios/exercicio-1/dicas')) {
          return new Promise<Response>((resolve) => {
            resolverPedidoDica = resolve
          })
        }
        return Promise.resolve(respostaAuthNaoAutenticado())
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mostra "Processando dica, aguarde..." e depois exibe a resposta na modal', async () => {
    renderWithProviders(<PedirDicaButton exercicioId="exercicio-1" contexto="sql" estado={{ estadoSql: 'SELECT 1' }} semConteudo={false} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /pedir dica \(sql\)/i }))

    expect(await screen.findByText(/processando dica, aguarde/i)).toBeInTheDocument()

    resolverPedidoDica?.(
      new Response(
        JSON.stringify({
          data: { id: 'dica-1', contexto: 'sql', respostaIa: 'Revise a cláusula WHERE.', criadoEm: '2026-01-01T00:00:00.000Z' },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    expect(await screen.findByText('Revise a cláusula WHERE.')).toBeInTheDocument()
  })

  it('desabilita o botão e avisa quando o limite de dicas é atingido (409)', async () => {
    renderWithProviders(<PedirDicaButton exercicioId="exercicio-1" contexto="sql" estado={{ estadoSql: 'SELECT 1' }} semConteudo={false} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /pedir dica \(sql\)/i }))
    resolverPedidoDica?.(
      new Response(JSON.stringify({ error: { code: 'CONFLICT', message: 'Limite de 5 dicas atingido' } }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    expect(await screen.findByText(/limite de dicas atingido/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pedir dica \(sql\)/i })).toBeDisabled()
  })

  it('desabilita o botão quando a IA não está configurada no ambiente, em vez de mandar tentar de novo', async () => {
    renderWithProviders(<PedirDicaButton exercicioId="exercicio-1" contexto="sql" estado={{ estadoSql: 'SELECT 1' }} semConteudo={false} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /pedir dica \(sql\)/i }))
    resolverPedidoDica?.(
      new Response(JSON.stringify({ error: { code: 'LLM_NAO_CONFIGURADO', message: 'Dicas de IA não configuradas neste ambiente' } }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    expect(await screen.findByText(/não estão ativas neste ambiente/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pedir dica \(sql\)/i })).toBeDisabled()
  })

  it('avisa quando o serviço de IA está indisponível (503), sem desabilitar o botão', async () => {
    renderWithProviders(<PedirDicaButton exercicioId="exercicio-1" contexto="sql" estado={{ estadoSql: 'SELECT 1' }} semConteudo={false} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /pedir dica \(sql\)/i }))
    resolverPedidoDica?.(
      new Response(JSON.stringify({ error: { code: 'LLM_UNAVAILABLE', message: 'Indisponível' } }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    expect(await screen.findByText(/indispon[ií]vel/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pedir dica \(sql\)/i })).not.toBeDisabled()
  })
})
