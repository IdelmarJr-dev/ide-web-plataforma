import { httpClient } from '../../../lib/httpClient'
import { postForBlob } from '../../../lib/downloadBlob'
import type { ImagemModelo } from '../modelagem/captura'
import type {
  AtualizarExercicioInput,
  CriarExercicioInput,
  DiagramaMer,
  ExercicioAluno,
  ExercicioProfessor,
  RespostasDoAluno,
  ResultadoExercicio,
  RevisarResultadoInput,
  SandboxEnvioResultado,
  SandboxResultado,
} from '../types'

export interface PacotePedido {
  // Até duas: modelo conceitual e modelo lógico (ver FinalizarPacoteButton).
  imagens: ImagemModelo[]
  sqlModelo?: string
}

export const exercicioService = {
  buscarPorId: (id: string): Promise<ExercicioAluno | ExercicioProfessor> =>
    httpClient.get<ExercicioAluno | ExercicioProfessor>(`/exercicios/${id}`),

  listarPorTurma: (turmaId: string): Promise<(ExercicioAluno | ExercicioProfessor)[]> =>
    httpClient.get<(ExercicioAluno | ExercicioProfessor)[]>(`/turmas/${turmaId}/exercicios`),

  criar: (input: CriarExercicioInput): Promise<ExercicioProfessor> =>
    httpClient.post<ExercicioProfessor>('/exercicios', input),

  atualizar: (id: string, input: AtualizarExercicioInput): Promise<ExercicioProfessor> =>
    httpClient.patch<ExercicioProfessor>(`/exercicios/${id}`, input),

  liberarGabarito: (id: string): Promise<ExercicioProfessor> =>
    httpClient.post<ExercicioProfessor>(`/exercicios/${id}/liberar-gabarito`),

  ocultarGabarito: (id: string): Promise<ExercicioProfessor> =>
    httpClient.post<ExercicioProfessor>(`/exercicios/${id}/ocultar-gabarito`),

  meuResultado: (id: string): Promise<ResultadoExercicio | null> =>
    httpClient.get<ResultadoExercicio | null>(`/exercicios/${id}/resultado`),

  revisarResultado: (exercicioId: string, usuarioId: string, input: RevisarResultadoInput): Promise<ResultadoExercicio> =>
    httpClient.patch<ResultadoExercicio>(`/exercicios/${exercicioId}/alunos/${usuarioId}/resultado`, input),

  resultadoDoAluno: (exercicioId: string, usuarioId: string): Promise<ResultadoExercicio | null> =>
    httpClient.get<ResultadoExercicio | null>(`/exercicios/${exercicioId}/alunos/${usuarioId}/resultado`),

  respostasDoAluno: (exercicioId: string, usuarioId: string): Promise<RespostasDoAluno> =>
    httpClient.get<RespostasDoAluno>(`/exercicios/${exercicioId}/alunos/${usuarioId}/respostas`),

  getDiagrama: (exercicioId: string): Promise<DiagramaMer | null> =>
    httpClient.get<DiagramaMer | null>(`/exercicios/${exercicioId}/diagrama`),

  salvarDiagrama: (exercicioId: string, conteudoJson: unknown): Promise<DiagramaMer> =>
    httpClient.put<DiagramaMer>(`/exercicios/${exercicioId}/diagrama`, { conteudoJson }),

  testarSql: (exercicioId: string, sql: string): Promise<SandboxResultado> =>
    httpClient.post<SandboxResultado>(`/exercicios/${exercicioId}/sandbox/testar`, { sql }),

  enviarSql: (exercicioId: string, sql: string): Promise<SandboxEnvioResultado> =>
    httpClient.post<SandboxEnvioResultado>(`/exercicios/${exercicioId}/sandbox/enviar`, { sql }),

  baixarPacote: (exercicioId: string, corpo: PacotePedido): Promise<Blob> =>
    postForBlob(`/exercicios/${exercicioId}/pacote`, corpo),

  // Encerra o exercício: marca a conclusão e apaga o banco do sandbox. Baixar o PDF
  // deixou de fazer isso de carona (Fase 8).
  finalizar: (exercicioId: string): Promise<null> => httpClient.post<null>(`/exercicios/${exercicioId}/finalizar`),

  listarPublicos: (): Promise<ExercicioAluno[]> => httpClient.get<ExercicioAluno[]>('/exercicios/publicos'),

  diagramaDoAluno: (exercicioId: string, usuarioId: string): Promise<DiagramaMer | null> =>
    httpClient.get<DiagramaMer | null>(`/exercicios/${exercicioId}/alunos/${usuarioId}/diagrama`),
}
