import { httpClient } from '../../../lib/httpClient'
import type { Aluno, CriarTurmaInput, Turma } from '../types'

export const turmasService = {
  criar: (input: CriarTurmaInput): Promise<Turma> => httpClient.post<Turma>('/turmas', input),

  minhas: (): Promise<Turma[]> => httpClient.get<Turma[]>('/turmas/minhas'),

  listarAlunos: (turmaId: string): Promise<Aluno[]> => httpClient.get<Aluno[]>(`/turmas/${turmaId}/alunos`),

  matricular: (codigo: string): Promise<Turma> => httpClient.post<Turma>(`/turmas/${codigo}/matricular`),

  encerrar: (turmaId: string): Promise<Turma> => httpClient.post<Turma>(`/turmas/${turmaId}/encerrar`),

  reabrir: (turmaId: string): Promise<Turma> => httpClient.post<Turma>(`/turmas/${turmaId}/reabrir`),
}
