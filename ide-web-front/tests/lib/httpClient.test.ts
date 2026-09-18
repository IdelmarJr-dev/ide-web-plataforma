import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { httpClient } from '../../src/lib/httpClient'

function resposta(status: number, corpo: unknown = {}): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('httpClient — renovação de sessão', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // Fase 10, D2: a sessão caía em 15 min porque ninguém chamava /auth/refresh.
  it('renova a sessão no 401 e refaz a requisição', async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(401, { error: { code: 'UNAUTHORIZED', message: 'expirou' } }))
      .mockResolvedValueOnce(resposta(200))
      .mockResolvedValueOnce(resposta(200, { data: { ok: true } }))

    await expect(httpClient.get('/turmas/minhas')).resolves.toEqual({ ok: true })

    const chamadas = fetchMock.mock.calls.map((chamada) => String(chamada[0]))
    expect(chamadas[1]).toContain('/auth/refresh')
    expect(chamadas[2]).toContain('/turmas/minhas')
  })

  it('propaga o 401 quando a renovação falha, em vez de tentar para sempre', async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(401, { error: { code: 'UNAUTHORIZED', message: 'expirou' } }))
      .mockResolvedValueOnce(resposta(401))

    await expect(httpClient.get('/turmas/minhas')).rejects.toThrow('expirou')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  // Renovar no login daria laço: 401 ali é resposta legítima (senha errada).
  it('não tenta renovar quando o próprio login devolve 401', async () => {
    fetchMock.mockResolvedValueOnce(resposta(401, { error: { code: 'UNAUTHORIZED', message: 'Credenciais inválidas' } }))

    await expect(httpClient.post('/auth/login', {})).rejects.toThrow('Credenciais inválidas')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('renova uma vez só quando várias requisições tomam 401 juntas', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes('/auth/refresh')) return Promise.resolve(resposta(200))
      if (init?.method === 'GET' && fetchMock.mock.calls.filter((c) => String(c[0]).includes('/turmas')).length <= 2) {
        return Promise.resolve(resposta(401, { error: { code: 'UNAUTHORIZED', message: 'expirou' } }))
      }
      return Promise.resolve(resposta(200, { data: { ok: true } }))
    })

    await Promise.all([httpClient.get('/turmas/a'), httpClient.get('/turmas/b')])

    const renovacoes = fetchMock.mock.calls.filter((chamada) => String(chamada[0]).includes('/auth/refresh'))
    expect(renovacoes).toHaveLength(1)
  })
})
