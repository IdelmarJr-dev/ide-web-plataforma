import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { pesquisaService } from '../services/pesquisaService'
import type { MinhaParticipacao } from '../types'

export const MINHA_PARTICIPACAO_QUERY_KEY = ['pesquisa', 'minha-participacao'] as const
const POLL_INTERVAL_MS = 5000
/**
 * Com o backend de pesquisa fora do ar, o polling batia a cada 5 s para sempre — 18+ chamadas
 * observadas no teste exploratório de 2026-09-16, todas 503 (Fase 9, D22). Depois de três
 * falhas seguidas o hook desiste, e a tela mostra que a pesquisa está indisponível em vez de
 * fingir que está carregando.
 */
const FALHAS_ATE_DESISTIR = 3

/**
 * Sem essa variável configurada, o backend de pesquisa não tem endereço de produção —
 * só existe localmente ou no servidor self-hosted do autor. Sem essa checagem, todo
 * aluno em produção batia em `localhost:8001` a cada 5s até desistir (Fase 9, D22 já
 * reduzia o dano, mas não evitava a primeira rodada de erros).
 */
const RESEARCH_API_CONFIGURADA = import.meta.env.VITE_RESEARCH_API_URL !== undefined

/** `false` = não reagenda. Exportada para ser testável sem depender de timers. */
export function intervaloDePolling(falhasConsecutivas: number): number | false {
  return falhasConsecutivas >= FALHAS_ATE_DESISTIR ? false : POLL_INTERVAL_MS
}

/**
 * Participação do aluno na pesquisa ativa da turma, com polling — é assim que todas
 * as máquinas da turma veem o convite, o sorteio e o avanço ao mesmo tempo.
 */
export function useMinhaParticipacao(enabled = true): UseQueryResult<MinhaParticipacao> {
  return useQuery<MinhaParticipacao>({
    queryKey: MINHA_PARTICIPACAO_QUERY_KEY,
    queryFn: pesquisaService.minhaParticipacao,
    enabled: enabled && RESEARCH_API_CONFIGURADA,
    refetchInterval: (query) => intervaloDePolling(query.state.fetchFailureCount),
    retry: false,
  })
}
