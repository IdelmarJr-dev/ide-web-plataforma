import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { painelService } from '../services/painelService'
import type { PainelAluno, PainelProfessor, PainelTurma } from '../types'

// Dado de painel envelhece devagar; 30 s evita refetch a cada foco de janela (Fase 9, D12).
const STALE_TIME_MS = 30_000

export const PAINEL_PROFESSOR_QUERY_KEY = ['painel', 'professor'] as const
export const PAINEL_ALUNO_QUERY_KEY = ['painel', 'aluno'] as const

export function usePainelProfessor(): UseQueryResult<PainelProfessor> {
  return useQuery({
    queryKey: PAINEL_PROFESSOR_QUERY_KEY,
    queryFn: painelService.doProfessor,
    staleTime: STALE_TIME_MS,
  })
}

export function usePainelAluno(): UseQueryResult<PainelAluno> {
  return useQuery({
    queryKey: PAINEL_ALUNO_QUERY_KEY,
    queryFn: painelService.doAluno,
    staleTime: STALE_TIME_MS,
  })
}

export function usePainelTurma(turmaId: string | undefined): UseQueryResult<PainelTurma> {
  return useQuery({
    queryKey: ['painel', 'turma', turmaId],
    queryFn: () => painelService.daTurma(turmaId ?? ''),
    enabled: turmaId !== undefined,
    staleTime: STALE_TIME_MS,
  })
}
