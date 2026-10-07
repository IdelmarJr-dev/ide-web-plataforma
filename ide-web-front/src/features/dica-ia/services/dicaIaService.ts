import { httpClient } from '../../../lib/httpClient'
import type { DicaIa, DicaLivre, PedirDicaInput, PedirDicaLivreInput } from '../types'

export const dicaIaService = {
  pedir: (exercicioId: string, input: PedirDicaInput): Promise<DicaIa> =>
    httpClient.post<DicaIa>(`/exercicios/${exercicioId}/dicas`, input),
  pedirLivre: (input: PedirDicaLivreInput): Promise<DicaLivre> =>
    httpClient.post<DicaLivre>('/sandbox/livre/dicas', input),
}
