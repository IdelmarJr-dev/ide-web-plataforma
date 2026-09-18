import { vi } from 'vitest'
import type { MinhaParticipacao } from '../../../src/features/pesquisa/types'

/**
 * Mock de `fetch` pros testes da pesquisa: simula o Node (envelope `{ data }`, com
 * `/auth/me` e `/pesquisa/token`) e o backend Python (JSON cru). `rotas` recebe o
 * caminho (sem host) e devolve o corpo — ou undefined pra 404.
 */
const TOKEN_FALSO = `x.${btoa(JSON.stringify({ exp: 4_102_444_800 }))}.y`

export const ALUNO = { id: 'aluno-1', nome: 'Aluno', email: null, papel: 'aluno', turmaId: 'turma-1' }

export const PESQUISA = {
  id: 'pesquisa-1',
  turmaId: 'turma-1',
  exercicioIds: ['ex-1'],
  iniciadaEm: '2026-09-14T10:00:00Z',
  gruposSorteadosEm: '2026-09-14T10:05:00Z',
  encerradaEm: null,
}

export function participacao(overrides: Partial<MinhaParticipacao> = {}): MinhaParticipacao {
  return {
    pesquisa: PESQUISA,
    tcle: 'aceito',
    grupo: 'experimental',
    ambiente: 'ide_web',
    sessao: null,
    susRespondido: false,
    rtlxRespondido: false,
    ...overrides,
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export interface Chamada {
  metodo: string
  caminho: string
  corpo: unknown
}

export function mockFetchPesquisa(rotas: Record<string, unknown>, usuario: unknown = ALUNO): Chamada[] {
  const chamadas: Chamada[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      const caminho = url.pathname.replace(/^\/api\/v1/, '') + url.search
      const metodo = init?.method ?? 'GET'
      chamadas.push({ metodo, caminho, corpo: init?.body ? JSON.parse(String(init.body)) : undefined })

      if (caminho === '/auth/me') return Promise.resolve(json({ data: usuario }))
      if (caminho === '/pesquisa/token') return Promise.resolve(json({ data: { token: TOKEN_FALSO } }))

      const chave = `${metodo} ${caminho}`
      if (chave in rotas) {
        const corpo = rotas[chave]
        const ehNode = url.port === '3000'
        return Promise.resolve(json(ehNode ? { data: corpo } : corpo))
      }
      return Promise.resolve(json({ detail: 'não encontrado' }, 404))
    }),
  )
  return chamadas
}
