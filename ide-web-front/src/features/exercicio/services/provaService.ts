import { httpClient } from '../../../lib/httpClient'
import type { AcervoProvas, MontarProvaInput, Prova, SortearProvasResultado } from '../types'

export const provaService = {
  criar: (turmaId: string, titulo: string): Promise<Prova> =>
    httpClient.post<Prova>(`/turmas/${turmaId}/provas`, { titulo }),

  listarPorTurma: (turmaId: string): Promise<Prova[]> => httpClient.get<Prova[]>(`/turmas/${turmaId}/provas`),

  acervo: (turmaId: string): Promise<AcervoProvas> => httpClient.get<AcervoProvas>(`/turmas/${turmaId}/provas/acervo`),

  montarComAssistente: (turmaId: string, input: MontarProvaInput): Promise<Prova & { questoes: number }> =>
    httpClient.post<Prova & { questoes: number }>(`/turmas/${turmaId}/provas/assistente`, input),

  sortear: (turmaId: string): Promise<SortearProvasResultado> =>
    httpClient.post<SortearProvasResultado>(`/turmas/${turmaId}/sortear-provas`),
}
