import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { AuthProvider } from '../../../src/features/auth/context/AuthProvider'
import { useBloqueioPesquisa } from '../../../src/features/pesquisa/hooks/useBloqueioPesquisa'
import { ALUNO, mockFetchPesquisa, participacao } from './pesquisaFetchMock'

function wrapper({ children }: { children: ReactNode }): ReactNode {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
}

describe('useBloqueioPesquisa', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('bloqueia a IDE para o grupo controle enquanto a pesquisa está ativa', async () => {
    mockFetchPesquisa({
      'GET /pesquisa/minha-participacao': participacao({ grupo: 'controle', ambiente: 'ferramentas_tradicionais' }),
    })

    const { result } = renderHook(() => useBloqueioPesquisa(), { wrapper })

    await waitFor(() => { expect(result.current.bloqueado).toBe(true) })
  })

  it('não bloqueia o grupo experimental', async () => {
    const chamadas = mockFetchPesquisa({ 'GET /pesquisa/minha-participacao': participacao() })

    const { result } = renderHook(() => useBloqueioPesquisa(), { wrapper })

    await waitFor(() => { expect(chamadas.some((chamada) => chamada.caminho === '/pesquisa/minha-participacao')).toBe(true) })
    expect(result.current.bloqueado).toBe(false)
  })

  it('não consulta a pesquisa para professor', async () => {
    const chamadas = mockFetchPesquisa({}, { ...ALUNO, papel: 'professor', turmaId: null })

    const { result } = renderHook(() => useBloqueioPesquisa(), { wrapper })

    await waitFor(() => { expect(chamadas.some((chamada) => chamada.caminho === '/auth/me')).toBe(true) })
    expect(result.current.bloqueado).toBe(false)
    expect(chamadas.some((chamada) => chamada.caminho === '/pesquisa/minha-participacao')).toBe(false)
  })
})
