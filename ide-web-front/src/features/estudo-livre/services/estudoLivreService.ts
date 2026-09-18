import { httpClient } from '../../../lib/httpClient'
import type { ExercicioAluno, SandboxResultado } from '~features/exercicio/types'

/**
 * Estudo livre: banco de dados próprio do aluno, sem exercício e sem turma. Diferente
 * do sandbox de exercício, aqui o aluno tem permissão de criar as próprias tabelas —
 * ver docs/decisions/fase8-conta-do-aluno-matricula-estudo-livre.md.
 */
export const estudoLivreService = {
  executar: (sql: string): Promise<SandboxResultado> =>
    httpClient.post<SandboxResultado>('/sandbox/livre/executar', { sql }),

  limparBanco: (): Promise<null> => httpClient.delete<null>(`/sandbox/livre`),

  exerciciosPublicos: (): Promise<ExercicioAluno[]> => httpClient.get<ExercicioAluno[]>('/exercicios/publicos'),
}
