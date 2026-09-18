import { describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  intervaloDePolling,
  useMinhaParticipacao,
} from '../../../src/features/pesquisa/hooks/useMinhaParticipacao'

function wrapper({ children }: { children: ReactNode }): ReactNode {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useMinhaParticipacao', () => {
  // Fase 9, D22: com o serviço de pesquisa fora do ar, o polling batia a cada 5 s para
  // sempre (18+ chamadas 503 no teste exploratório). Depois de 3 falhas ele desiste.
  it('continua repetindo enquanto as falhas não passam do limite', () => {
    expect(intervaloDePolling(0)).toBe(5000)
    expect(intervaloDePolling(2)).toBe(5000)
  })

  it('desiste de reagendar a partir da terceira falha consecutiva', () => {
    expect(intervaloDePolling(3)).toBe(false)
    expect(intervaloDePolling(10)).toBe(false)
  })

  it('expõe o erro para a tela poder dizer que a pesquisa está indisponível', async () => {
    const { result } = renderHook(() => useMinhaParticipacao(), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})
