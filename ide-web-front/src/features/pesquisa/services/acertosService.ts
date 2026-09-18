import { httpClient } from '../../../lib/httpClient'
import type { AcertosTarefa } from '../types'

/**
 * Acertos/tentativas/dicas por aluno nos exercícios da tarefa. Diferente do resto da
 * feature, isto é do backend Node (é onde ficam as submissões SQL e as dicas).
 */
export const acertosService = {
  buscar: (exercicioIds: string[]): Promise<AcertosTarefa> =>
    httpClient.get<AcertosTarefa>(`/pesquisa/acertos?exercicioIds=${exercicioIds.map(encodeURIComponent).join(',')}`),
}
