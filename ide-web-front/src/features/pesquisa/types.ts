export type Ambiente = 'ide_web' | 'ferramentas_tradicionais'
export type Grupo = 'controle' | 'experimental'
export type SituacaoTcle = 'pendente' | 'aceito' | 'recusado'

export interface Pesquisa {
  id: string
  turmaId: string
  exercicioIds: string[]
  iniciadaEm: string
  gruposSorteadosEm: string | null
  encerradaEm: string | null
}

export interface PesquisaStatus {
  iniciada: boolean
  pesquisaId: string | null
  iniciadaEm: string | null
  gruposSorteados: boolean
}

export interface SessaoResumo {
  id: string
  iniciadaEm: string
  finalizadaEm: string | null
}

/** Estado do aluno na pesquisa ativa da turma — única fonte do fluxo no frontend. */
export interface MinhaParticipacao {
  pesquisa: Pesquisa | null
  tcle: SituacaoTcle
  grupo: Grupo | null
  ambiente: Ambiente | null
  sessao: SessaoResumo | null
  susRespondido: boolean
  rtlxRespondido: boolean
}

export interface Sessao extends SessaoResumo {
  ambiente: Ambiente
}

export interface TcleStatus {
  consentido: boolean
  versaoTermo: string
  respondidoEm: string
}

export interface SorteioResultado {
  alocadosAgora: number
  controle: number
  experimental: number
}

export interface Participantes {
  consentiram: number
  recusaram: number
  controle: number
  experimental: number
  semGrupo: number
  sessoesIniciadas: number
  sessoesFinalizadas: number
  susRespondidos: number
  rtlxRespondidos: number
}

export interface LinhaExportacao {
  usuarioId: string
  grupo: Grupo | null
  ambiente: Ambiente | null
  sessaoIniciadaEm: string | null
  sessaoFinalizadaEm: string | null
  duracaoMinutos: number | null
  susItens: Record<string, number> | null
  susPontuacao: string | null
  rtlxDimensoes: Record<string, number> | null
  rtlxPontuacao: string | null
}

export interface Exportacao {
  pesquisa: Pesquisa
  participantes: LinhaExportacao[]
}

export interface AcertoExercicio {
  exercicioId: string
  tentativas: number
  correta: boolean | null
  dicasSql: number
  dicasMer: number
}

export interface AcertosTarefa {
  turmaId: string
  exercicioIds: string[]
  alunos: { usuarioId: string; exercicios: AcertoExercicio[] }[]
}
