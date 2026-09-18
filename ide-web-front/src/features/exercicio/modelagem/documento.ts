import { z } from 'zod'

/**
 * Documento de modelagem (versão 2): modelo conceitual (notação de Chen) e modelo
 * lógico (tabelas), ligados pelo assistente de conversão — ver
 * docs/decisions/fase7-modelagem-conceitual-logica.md. Salvo em
 * `DiagramaMer.conteudo_json` (aluno) e `Exercicio.mer_gabarito` (professor).
 *
 * Espelho de `ide-web-backend/src/dtos/modelagem.schema.ts` — mantenha os dois iguais.
 * Campos opcionais são `null` (e não ausentes) para o JSON ter sempre o mesmo formato.
 */

export const MODOS_MODELAGEM = ['conceitual', 'logico', 'conceitual_logico'] as const
export type ModoModelagem = (typeof MODOS_MODELAGEM)[number]

export const TIPOS_COLUNA = [
  'INTEGER',
  'BIGINT',
  'SMALLINT',
  'NUMERIC',
  'REAL',
  'VARCHAR',
  'CHAR',
  'TEXT',
  'DATE',
  'TIME',
  'TIMESTAMP',
  'BOOLEAN',
] as const
export type TipoColuna = (typeof TIPOS_COLUNA)[number]

export const TIPOS_INTEIROS: readonly TipoColuna[] = ['INTEGER', 'BIGINT', 'SMALLINT']
export const TIPOS_COM_TAMANHO: readonly TipoColuna[] = ['VARCHAR', 'CHAR', 'NUMERIC']

export const CARDINALIDADES_ATRIBUTO = ['(1,1)', '(0,1)', '(0,n)', '(1,n)'] as const
export type CardinalidadeAtributo = (typeof CARDINALIDADES_ATRIBUTO)[number]

export const VISOES_ATRIBUTOS = ['circulos', 'lista'] as const
export type VisaoAtributos = (typeof VISOES_ATRIBUTOS)[number]

export const ESTRATEGIAS_CONVERSAO = [
  'fk_lado_total',
  'fundir',
  'tabela_propria',
  'tabela_por_entidade',
  'tabela_unica',
  'so_especializadas',
] as const
export type EstrategiaConversao = (typeof ESTRATEGIAS_CONVERSAO)[number]

// Limites: generosos para sala de aula, só barram payload abusivo. 63 = limite de
// identificador do PostgreSQL.
export const LIMITES = {
  nome: 63,
  id: 100,
  texto: 500,
  expressao: 200,
  elementosConceituais: 400,
  ligacoesConceituais: 400,
  tabelas: 150,
  colunasPorTabela: 60,
  notas: 50,
  tamanhoMaximo: 10_485_760,
  escalaMaxima: 1000,
} as const

export const VERSAO_DOCUMENTO = 2

const idSchema = z.string().min(1).max(LIMITES.id)
const nomeSchema = z.string().max(LIMITES.nome)
const posicaoSchema = z.object({ x: z.number(), y: z.number() })

// ---------------------------------------------------------------------------
// Modelo lógico
// ---------------------------------------------------------------------------

export const colunaSchema = z.object({
  id: idSchema,
  nome: nomeSchema,
  tipo: z.enum(TIPOS_COLUNA),
  // VARCHAR(n)/CHAR(n): tamanho; NUMERIC(p,s): tamanho = p, escala = s.
  tamanho: z.number().int().min(1).max(LIMITES.tamanhoMaximo).nullable(),
  escala: z.number().int().min(0).max(LIMITES.escalaMaxima).nullable(),
  pk: z.boolean(),
  notNull: z.boolean(),
  unique: z.boolean(),
  autoIncremento: z.boolean(),
  padrao: z.string().max(LIMITES.expressao),
  check: z.string().max(LIMITES.expressao),
  fk: z.object({ tabelaId: idSchema, colunaId: idSchema }).nullable(),
})

export const tabelaSchema = z.object({
  id: idSchema,
  posicao: posicaoSchema,
  nome: nomeSchema,
  colunas: z.array(colunaSchema).max(LIMITES.colunasPorTabela),
})

export const notaSchema = z.object({
  id: idSchema,
  posicao: posicaoSchema,
  texto: z.string().max(LIMITES.texto),
})

export const modeloLogicoSchema = z.object({
  tabelas: z.array(tabelaSchema).max(LIMITES.tabelas),
  notas: z.array(notaSchema).max(LIMITES.notas),
})

// ---------------------------------------------------------------------------
// Modelo conceitual
// ---------------------------------------------------------------------------

const baseElemento = { id: idSchema, posicao: posicaoSchema }

const entidadeSchema = z.object({ ...baseElemento, tipo: z.literal('entidade'), nome: nomeSchema })

const relacionamentoSchema = z.object({
  ...baseElemento,
  tipo: z.literal('relacionamento'),
  nome: nomeSchema,
  // Entidade associativa: o relacionamento "vira" entidade e pode participar de outros relacionamentos.
  associativa: z.boolean(),
})

const atributoSchema = z.object({
  ...baseElemento,
  tipo: z.literal('atributo'),
  nome: nomeSchema,
  // Entidade, relacionamento ou outro atributo (atributo composto = atributo com filhos).
  paiId: idSchema,
  chave: z.boolean(),
  cardinalidade: z.enum(CARDINALIDADES_ATRIBUTO),
  tipoSugerido: z
    .object({
      tipo: z.enum(TIPOS_COLUNA),
      tamanho: z.number().int().min(1).max(LIMITES.tamanhoMaximo).nullable(),
      escala: z.number().int().min(0).max(LIMITES.escalaMaxima).nullable(),
    })
    .nullable(),
})

const especializacaoSchema = z.object({
  ...baseElemento,
  tipo: z.literal('especializacao'),
  paiId: idSchema,
  total: z.boolean(),
  disjunta: z.boolean(),
})

const notaConceitualSchema = z.object({ ...baseElemento, tipo: z.literal('nota'), texto: z.string().max(LIMITES.texto) })

export const elementoConceitualSchema = z.discriminatedUnion('tipo', [
  entidadeSchema,
  relacionamentoSchema,
  atributoSchema,
  especializacaoSchema,
  notaConceitualSchema,
])

const participacaoSchema = z.object({
  id: idSchema,
  tipo: z.literal('participacao'),
  relacionamentoId: idSchema,
  // Entidade ou relacionamento associativo.
  entidadeId: idSchema,
  min: z.union([z.literal(0), z.literal(1)]),
  max: z.enum(['1', 'n']),
  papel: nomeSchema,
})

const filhoEspecializacaoSchema = z.object({
  id: idSchema,
  tipo: z.literal('filho_especializacao'),
  especializacaoId: idSchema,
  entidadeId: idSchema,
})

export const ligacaoConceitualSchema = z.discriminatedUnion('tipo', [participacaoSchema, filhoEspecializacaoSchema])

export const modeloConceitualSchema = z.object({
  elementos: z.array(elementoConceitualSchema).max(LIMITES.elementosConceituais),
  ligacoes: z.array(ligacaoConceitualSchema).max(LIMITES.ligacoesConceituais),
  visaoAtributos: z.enum(VISOES_ATRIBUTOS),
})

export const conversaoSchema = z.object({
  assinaturaConceitual: z.string().max(LIMITES.id),
  convertidoEm: z.string().max(LIMITES.id),
  escolhas: z.record(z.string().max(LIMITES.id), z.enum(ESTRATEGIAS_CONVERSAO)),
})

export type Coluna = z.infer<typeof colunaSchema>
export type Tabela = z.infer<typeof tabelaSchema>
export type Nota = z.infer<typeof notaSchema>
export type ModeloLogico = z.infer<typeof modeloLogicoSchema>
export type ElementoConceitual = z.infer<typeof elementoConceitualSchema>
export type LigacaoConceitual = z.infer<typeof ligacaoConceitualSchema>
export type ModeloConceitual = z.infer<typeof modeloConceitualSchema>
export type Conversao = z.infer<typeof conversaoSchema>

// ---------------------------------------------------------------------------
// Integridade referencial (o que o formato sozinho não garante)
// ---------------------------------------------------------------------------

/** Lista os problemas de integridade do modelo lógico; vazio = consistente. */
export function problemasDoLogico(logico: ModeloLogico): string[] {
  const problemas: string[] = []
  const ids = new Set<string>()
  const colunasPorTabela = new Map<string, Set<string>>()

  for (const tabela of logico.tabelas) {
    if (ids.has(tabela.id)) problemas.push(`id repetido: ${tabela.id}`)
    ids.add(tabela.id)
    const colunas = new Set<string>()
    for (const coluna of tabela.colunas) {
      if (ids.has(coluna.id)) problemas.push(`id repetido: ${coluna.id}`)
      ids.add(coluna.id)
      colunas.add(coluna.id)
    }
    colunasPorTabela.set(tabela.id, colunas)
  }
  for (const nota of logico.notas) {
    if (ids.has(nota.id)) problemas.push(`id repetido: ${nota.id}`)
    ids.add(nota.id)
  }

  for (const tabela of logico.tabelas) {
    for (const coluna of tabela.colunas) {
      if (coluna.fk && !colunasPorTabela.get(coluna.fk.tabelaId)?.has(coluna.fk.colunaId)) {
        problemas.push(`chave estrangeira aponta para coluna inexistente: ${coluna.id}`)
      }
    }
  }
  return problemas
}

/** Lista os problemas de integridade do modelo conceitual; vazio = consistente. */
export function problemasDoConceitual(conceitual: ModeloConceitual): string[] {
  const problemas: string[] = []
  const porId = new Map<string, ElementoConceitual>()

  for (const elemento of conceitual.elementos) {
    if (porId.has(elemento.id)) problemas.push(`id repetido: ${elemento.id}`)
    porId.set(elemento.id, elemento)
  }
  const idsLigacoes = new Set<string>()
  for (const ligacao of conceitual.ligacoes) {
    if (idsLigacoes.has(ligacao.id) || porId.has(ligacao.id)) problemas.push(`id repetido: ${ligacao.id}`)
    idsLigacoes.add(ligacao.id)
  }

  const tipoDe = (id: string): ElementoConceitual['tipo'] | undefined => porId.get(id)?.tipo
  const ehEntidadeOuAssociativa = (id: string): boolean => {
    const alvo = porId.get(id)
    return alvo?.tipo === 'entidade' || (alvo?.tipo === 'relacionamento' && alvo.associativa)
  }

  for (const elemento of conceitual.elementos) {
    if (elemento.tipo === 'atributo') {
      const tipoPai = tipoDe(elemento.paiId)
      if (tipoPai !== 'entidade' && tipoPai !== 'relacionamento' && tipoPai !== 'atributo') {
        problemas.push(`atributo sem entidade, relacionamento ou atributo pai: ${elemento.id}`)
      }
    }
    if (elemento.tipo === 'especializacao' && tipoDe(elemento.paiId) !== 'entidade') {
      problemas.push(`especialização sem entidade genérica: ${elemento.id}`)
    }
  }

  for (const ligacao of conceitual.ligacoes) {
    if (ligacao.tipo === 'participacao') {
      if (tipoDe(ligacao.relacionamentoId) !== 'relacionamento') {
        problemas.push(`participação sem relacionamento: ${ligacao.id}`)
      }
      if (!ehEntidadeOuAssociativa(ligacao.entidadeId) || ligacao.entidadeId === ligacao.relacionamentoId) {
        problemas.push(`participação sem entidade: ${ligacao.id}`)
      }
    } else {
      if (tipoDe(ligacao.especializacaoId) !== 'especializacao') {
        problemas.push(`filho de especialização sem especialização: ${ligacao.id}`)
      }
      if (tipoDe(ligacao.entidadeId) !== 'entidade') {
        problemas.push(`filho de especialização sem entidade: ${ligacao.id}`)
      }
    }
  }

  if (temCicloDeAtributos(conceitual.elementos)) problemas.push('atributos formam um ciclo')
  return problemas
}

function temCicloDeAtributos(elementos: ElementoConceitual[]): boolean {
  const paiDoAtributo = new Map<string, string>()
  for (const elemento of elementos) {
    if (elemento.tipo === 'atributo') paiDoAtributo.set(elemento.id, elemento.paiId)
  }
  for (const inicio of paiDoAtributo.keys()) {
    const visitados = new Set<string>()
    let atual: string | undefined = inicio
    while (atual !== undefined && paiDoAtributo.has(atual)) {
      if (visitados.has(atual)) return true
      visitados.add(atual)
      atual = paiDoAtributo.get(atual)
    }
  }
  return false
}

export const documentoModelagemSchema = z
  .object({
    versao: z.literal(VERSAO_DOCUMENTO),
    conceitual: modeloConceitualSchema.nullable(),
    logico: modeloLogicoSchema.nullable(),
    conversao: conversaoSchema.nullable(),
  })
  .superRefine((documento, contexto) => {
    const problemas = [
      ...(documento.conceitual ? problemasDoConceitual(documento.conceitual) : []),
      ...(documento.logico ? problemasDoLogico(documento.logico) : []),
    ]
    for (const problema of problemas) {
      contexto.addIssue({ code: 'custom', message: `Modelo inconsistente: ${problema}` })
    }
  })

export type DocumentoModelagem = z.infer<typeof documentoModelagemSchema>

export const DOCUMENTO_VAZIO: DocumentoModelagem = {
  versao: 2,
  conceitual: null,
  logico: null,
  conversao: null,
}

export const LOGICO_VAZIO: ModeloLogico = { tabelas: [], notas: [] }

export const CONCEITUAL_VAZIO: ModeloConceitual = { elementos: [], ligacoes: [], visaoAtributos: 'circulos' }

/**
 * Carrega um JSON salvo. Formato de antes da Fase 7 ou malformado vira documento
 * vazio — nunca quebra a tela.
 */
export function parseDocumento(conteudoJson: unknown): DocumentoModelagem {
  if (conteudoJson === null || conteudoJson === undefined) return DOCUMENTO_VAZIO

  const resultado = documentoModelagemSchema.safeParse(conteudoJson)
  if (!resultado.success) {
    console.warn('Modelagem em formato não reconhecido — carregada vazia.', resultado.error.issues)
    return DOCUMENTO_VAZIO
  }
  return resultado.data
}

/** Primeiro problema de validação do documento, pronto pra mostrar ao usuário; null = válido. */
export function erroDeValidacao(documento: DocumentoModelagem): string | null {
  const resultado = documentoModelagemSchema.safeParse(documento)
  if (resultado.success) return null
  const [primeiro] = resultado.error.issues
  if (primeiro?.code === 'too_big') {
    return 'O modelo passou do tamanho máximo permitido (muitos elementos ou texto longo demais).'
  }
  return primeiro?.message ?? 'Modelo inválido.'
}

export function documentoTemConteudo(documento: DocumentoModelagem): boolean {
  return (
    (documento.conceitual?.elementos.length ?? 0) > 0 || (documento.logico?.tabelas.length ?? 0) > 0
  )
}

export function resumirDocumento(documento: DocumentoModelagem): string {
  const partes: string[] = []
  const entidades = documento.conceitual?.elementos.filter((elemento) => elemento.tipo === 'entidade').length ?? 0
  const tabelas = documento.logico?.tabelas.length ?? 0
  if (entidades > 0) partes.push(`${String(entidades)} ${entidades === 1 ? 'entidade' : 'entidades'}`)
  if (tabelas > 0) partes.push(`${String(tabelas)} ${tabelas === 1 ? 'tabela' : 'tabelas'}`)
  return partes.length > 0 ? partes.join(', ') : 'vazio'
}

export function gerarId(prefixo: string): string {
  return `${prefixo}-${crypto.randomUUID()}`
}
