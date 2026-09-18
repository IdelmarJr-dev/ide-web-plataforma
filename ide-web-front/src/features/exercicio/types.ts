import { z } from 'zod'
import { documentoModelagemSchema, MODOS_MODELAGEM } from './modelagem/documento'
import type { ModoModelagem } from './modelagem/documento'

export const NIVEIS_DIFICULDADE = ['iniciante', 'intermediario'] as const
export type NivelDificuldade = (typeof NIVEIS_DIFICULDADE)[number]

export interface Prova {
  id: string
  turmaId: string
  titulo: string
  criadoEm: string
}

export interface SortearProvasResultado {
  alunosSorteados: number
}

export interface ExercicioAluno {
  id: string
  turmaId: string
  provaId: string | null
  titulo: string
  enunciado: string
  nivelDificuldade: NivelDificuldade
  ordem: number
  prazo: string | null
  // Exercício público: qualquer aluno logado resolve, sem matrícula na turma de origem.
  publico: boolean
  gabaritoLiberado: boolean
  temSql: boolean
  temMer: boolean
  temDissertativa: boolean
  // Nível da modelagem definido pelo professor (docs/decisions/fase7-modelagem-conceitual-logica.md).
  modoMer: ModoModelagem
  // Script de dados-exemplo (não é resposta) — o grupo controle da pesquisa carrega no pgAdmin.
  sqlSetup: string | null
  criadoEm: string
}

export interface ExercicioProfessor extends ExercicioAluno {
  merGabarito: unknown
  sqlGabarito: string | null
  gabaritoDissertativo: string | null
}

export const STATUS_SANDBOX = ['sucesso', 'erro_sintaxe', 'erro_execucao'] as const
export type StatusSandbox = (typeof STATUS_SANDBOX)[number]

export interface SandboxResultado {
  status: StatusSandbox
  rows?: Record<string, unknown>[]
  message?: string
}

export interface SandboxEnvioResultado extends SandboxResultado {
  correta: boolean | null
  submissaoId: string
  tentativaNumero: number
  plano: unknown
}

/** O que o aluno entregou, para o professor ver antes de dar nota (Fase 9, D17). */
export interface RespostasDoAluno {
  ultimaSubmissaoSql: { query: string; correta: boolean | null; criadoEm: string } | null
  dissertativa: { texto: string; atualizadoEm: string } | null
}

export interface DiagramaMer {
  id: string
  exercicioId: string
  usuarioId: string
  conteudoJson: unknown
  versao: number
  atualizadoEm: string
}

export interface ResultadoExercicio {
  id: string
  usuarioId: string
  exercicioId: string
  sqlCorreto: boolean | null
  merAvaliacao: number | null
  dissertativaAvaliacao: number | null
  acertos: number
  erros: number
  pontuacao: number | null
  // Quando o aluno deu o exercício por encerrado (Fase 8).
  finalizadoEm: string | null
  revisado: boolean
  revisadoEm: string | null
  criadoEm: string
}

export const criarExercicioSchema = z.object({
  turmaId: z.uuid(),
  provaId: z.uuid().optional(),
  titulo: z.string().trim().min(1, 'Informe o título.'),
  enunciado: z.string().trim().min(1, 'Informe o enunciado.'),
  nivelDificuldade: z.enum(NIVEIS_DIFICULDADE),
  // Fase 10, D12: o backend atribui a ordem; D7: prazo opcional.
  ordem: z.coerce.number().int().nonnegative().optional(),
  prazo: z.string().optional(),
  publico: z.boolean().optional(),
  sqlGabarito: z.string().trim().min(1).optional(),
  sqlSetup: z.string().trim().min(1).optional(),
  gabaritoDissertativo: z.string().trim().min(1).optional(),
  merGabarito: documentoModelagemSchema.optional(),
  modoMer: z.enum(MODOS_MODELAGEM).optional(),
})
export type CriarExercicioInput = z.infer<typeof criarExercicioSchema>

export const atualizarExercicioSchema = z.object({
  merGabarito: documentoModelagemSchema.optional(),
  modoMer: z.enum(MODOS_MODELAGEM).optional(),
})
export type AtualizarExercicioInput = z.infer<typeof atualizarExercicioSchema>

export const criarProvaSchema = z.object({
  turmaId: z.uuid(),
  titulo: z.string().trim().min(1, 'Informe o título da prova.'),
})
export type CriarProvaInput = z.infer<typeof criarProvaSchema>

export const NOTA_MAXIMA = 10

export const revisarResultadoSchema = z.object({
  sqlCorreto: z.boolean().optional(),
  // Escala do IFPI: 0,0 a 10,0 (Fase 10, D6).
  merAvaliacao: z.coerce.number().min(0).max(NOTA_MAXIMA).optional(),
  dissertativaAvaliacao: z.coerce.number().min(0).max(NOTA_MAXIMA).optional(),
  pontuacao: z.coerce.number().min(0).max(NOTA_MAXIMA).optional(),
})
export type RevisarResultadoInput = z.infer<typeof revisarResultadoSchema>

/** Quantos exercícios da turma ainda podem virar questão de prova (Fase 10, D13). */
export interface AcervoProvas {
  total: number
  porNivel: Record<NivelDificuldade, number>
}

export interface MontarProvaInput {
  titulo: string
  quantidade: number
  nivel?: NivelDificuldade
  prazo?: string
}
