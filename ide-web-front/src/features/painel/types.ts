import type { ExercicioAluno, ExercicioProfessor } from '~features/exercicio/types'
import type { Turma } from '~features/turmas/types'

export const ESTADOS_CELULA = [
  'nao_iniciou',
  'em_andamento',
  'entregue',
  'correto',
  'aguardando_revisao',
] as const
export type EstadoCelula = (typeof ESTADOS_CELULA)[number]

export interface TurmaDoPainel extends Turma {
  alunos: number
  exercicios: number
  entregas: number
  aguardandoRevisao: number
  ultimaAtividadeEm: string | null
}

export interface PainelProfessor {
  resumo: {
    turmasAtivas: number
    turmasEncerradas: number
    alunos: number
    exercicios: number
    aguardandoRevisao: number
  }
  turmas: TurmaDoPainel[]
}

export interface CelulaMatriz {
  alunoId: string
  exercicioId: string
  estado: EstadoCelula
  tentativas: number
  dicas: number
  finalizadoEm: string | null
  pontuacao: number | null
  ultimoEnvioComErro: boolean
}

export interface DificuldadeExercicio {
  exercicioId: string
  taxaAcerto: number | null
  mediaTentativas: number | null
  dicasPorAluno: number
}

export interface AlunoDaMatriz {
  id: string
  nome: string
  email: string | null
  provaId: string | null
}

export interface PainelTurma {
  turma: Turma
  exercicios: ExercicioProfessor[]
  alunos: AlunoDaMatriz[]
  celulas: CelulaMatriz[]
  dificuldade: DificuldadeExercicio[]
}

export interface ExercicioDoAluno extends ExercicioAluno {
  estado: EstadoCelula
  turmaId: string
  turmaNome: string
  disciplina: string
  gabaritoLiberado: boolean
  finalizadoEm: string | null
}

export interface PainelAluno {
  resumo: { turmas: number; pendentes: number; entregues: number; acertos: number }
  disciplinas: { disciplina: string; turmas: (Turma & { exercicios: ExercicioDoAluno[] })[] }[]
  pendencias: ExercicioDoAluno[]
  historico: ExercicioDoAluno[]
  progresso: {
    porTurma: { turmaId: string; turmaNome: string; total: number; entregues: number }[]
    tentativasAteAcertar: { exercicioId: string; titulo: string; tentativas: number }[]
  }
}

/** Rótulo textual além da cor: cor sozinha exclui daltônicos (Fase 9, D10). */
export const ROTULO_ESTADO: Record<EstadoCelula, string> = {
  nao_iniciou: 'Não iniciou',
  em_andamento: 'Em andamento',
  entregue: 'Entregue',
  correto: 'Correto',
  aguardando_revisao: 'Aguardando revisão',
}

/** Uma atividade do aluno na visão de quem vai corrigir (Fase 10, D4). */
export interface AtividadeDoAluno extends ExercicioProfessor {
  estado: EstadoCelula
  tentativas: number
  dicas: number
  finalizadoEm: string | null
  sqlCorreto: boolean | null
  merAvaliacao: number | null
  dissertativaAvaliacao: number | null
  pontuacao: number | null
  revisado: boolean
  envioLiberadoEm: string | null
  /** O último envio nem chegou a executar: o professor decide se devolve (D10). */
  ultimoEnvioComErro: boolean
}

export interface AtividadesDoAluno {
  aluno: { id: string; nome: string; email: string | null }
  turma: Turma
  atividades: AtividadeDoAluno[]
}
