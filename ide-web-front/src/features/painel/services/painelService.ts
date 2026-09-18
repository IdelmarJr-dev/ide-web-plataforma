import { httpClient } from '../../../lib/httpClient'
import type { AtividadesDoAluno, PainelAluno, PainelProfessor, PainelTurma } from '../types'

export const painelService = {
  doProfessor: (): Promise<PainelProfessor> => httpClient.get<PainelProfessor>('/painel/professor'),

  doAluno: (): Promise<PainelAluno> => httpClient.get<PainelAluno>('/painel/aluno'),

  daTurma: (turmaId: string): Promise<PainelTurma> => httpClient.get<PainelTurma>(`/turmas/${turmaId}/painel`),

  atividadesDoAluno: (turmaId: string, usuarioId: string): Promise<AtividadesDoAluno> =>
    httpClient.get<AtividadesDoAluno>(`/turmas/${turmaId}/alunos/${usuarioId}/atividades`),

  liberarEnvio: (exercicioId: string, usuarioId: string): Promise<{ liberado: boolean }> =>
    httpClient.post<{ liberado: boolean }>(`/exercicios/${exercicioId}/alunos/${usuarioId}/liberar-envio`),
}
