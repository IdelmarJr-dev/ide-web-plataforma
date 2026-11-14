import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DissertativaEditor } from '../../../src/features/exercicio/components/DissertativaEditor'
import { renderWithProviders } from '../../test-utils'

function resposta(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })
}

const SALVA = { exercicioId: 'e1', texto: 'LEFT JOIN mantém quem não tem pedido.', versao: 1, atualizadoEm: '2026-11-13T18:00:00.000Z' }

/** Responde /auth/me com 401 (o AuthProvider chama ao montar) e o resto conforme a rota. */
function simular(rotas: { get?: unknown; put?: () => Response }): ReturnType<typeof vi.fn> {
  const fetchFalso = vi.fn((url: string, init?: RequestInit) => {
    if (url.includes('/auth/')) return Promise.resolve(resposta(401, { error: { code: 'UNAUTHORIZED', message: 'x' } }))
    if (url.endsWith('/dissertativa') && init?.method === 'PUT') {
      return Promise.resolve(rotas.put ? rotas.put() : resposta(200, { data: SALVA }))
    }
    return Promise.resolve(resposta(200, { data: rotas.get ?? null }))
  })
  vi.stubGlobal('fetch', fetchFalso)
  return fetchFalso
}

function houvePut(fetchFalso: ReturnType<typeof vi.fn>): boolean {
  return fetchFalso.mock.calls.some(([url, init]) => String(url).endsWith('/dissertativa') && (init as RequestInit | undefined)?.method === 'PUT')
}

describe('DissertativaEditor', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reabre o exercício com a resposta que já estava salva', async () => {
    simular({ get: SALVA })
    renderWithProviders(<DissertativaEditor exercicioId="e1" />)

    expect(await screen.findByDisplayValue('LEFT JOIN mantém quem não tem pedido.')).toBeInTheDocument()
    expect(screen.getByLabelText('Sua resposta')).toBeInTheDocument()
  })

  // Antes, o texto só existia no navegador e se perdia.
  it('grava sozinho depois que o aluno para de digitar e avisa quando salvou', async () => {
    const fetchFalso = simular({})
    renderWithProviders(<DissertativaEditor exercicioId="e1" />)
    const user = userEvent.setup()
    const campo = await screen.findByLabelText('Sua resposta')
    await waitFor(() => { expect(campo).toBeEnabled() })

    await user.type(campo, 'Usei LEFT JOIN')

    expect(screen.getByText('Alteração ainda não salva')).toBeInTheDocument()
    expect(await screen.findByText(/Salvo às/, {}, { timeout: 4000 })).toBeInTheDocument()
    expect(houvePut(fetchFalso)).toBe(true)
  })

  it('quando não consegue salvar, diz o motivo e oferece tentar de novo', async () => {
    simular({
      put: () => resposta(403, { error: { code: 'FORBIDDEN', message: 'Esta turma foi encerrada e não aceita mais entregas' } }),
    })
    renderWithProviders(<DissertativaEditor exercicioId="e1" />)
    const user = userEvent.setup()
    const campo = await screen.findByLabelText('Sua resposta')
    await waitFor(() => { expect(campo).toBeEnabled() })

    await user.type(campo, 'texto')

    const alerta = await screen.findByRole('alert', {}, { timeout: 4000 })
    expect(alerta).toHaveTextContent('Esta turma foi encerrada e não aceita mais entregas')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })
})
