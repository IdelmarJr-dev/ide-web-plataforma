import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { pesquisaService } from '../services/pesquisaService'
import type { PesquisaStatus } from '../types'

const POLL_INTERVAL_MS = 5000

export function usePesquisaStatus(turmaId: string | null): UseQueryResult<PesquisaStatus> {
  return useQuery<PesquisaStatus>({
    queryKey: ['pesquisa', 'status', turmaId],
    queryFn: () => pesquisaService.statusPesquisa(turmaId ?? ''),
    enabled: turmaId !== null,
    refetchInterval: POLL_INTERVAL_MS,
    retry: false,
  })
}
