import { httpClient } from '../../../lib/httpClient'
import type { DicaIa, PedirDicaInput } from '../types'

export const dicaIaService = {
  pedir: (exercicioId: string, input: PedirDicaInput): Promise<DicaIa> =>
    httpClient.post<DicaIa>(`/exercicios/${exercicioId}/dicas`, input),
}
