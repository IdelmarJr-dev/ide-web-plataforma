import { z } from 'zod';

/**
 * Documento de modelagem (versão 2): modelo conceitual (notação de Chen) e modelo
 * lógico (tabelas) — ver docs/decisions/fase7-modelagem-conceitual-logica.md. Usado em
 * `DiagramaMer.conteudo_json` (aluno) e `Exercicio.mer_gabarito` (professor).
 *
 * Espelho de `ide-web-front/src/features/exercicio/modelagem/documento.ts` — mantenha
 * os dois iguais (limites, enums e checagens de integridade).
 */

export const MODOS_MODELAGEM = ['conceitual', 'logico', 'conceitual_logico'] as const;
export type ModoModelagem = (typeof MODOS_MODELAGEM)[number];
// Nível definido pelo professor no exercício (`Exercicio.modo_mer`) — desde a etapa 6 da
// Fase 7 não existe mais o modo "aluno escolhe": o nível é sempre do professor.
export const MODOS_EXERCICIO = MODOS_MODELAGEM;
export type ModoExercicio = ModoModelagem;

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
] as const;
export type TipoColuna = (typeof TIPOS_COLUNA)[number];

export const TIPOS_INTEIROS: readonly TipoColuna[] = ['INTEGER', 'BIGINT', 'SMALLINT'];

export const CARDINALIDADES_ATRIBUTO = ['(1,1)', '(0,1)', '(0,n)', '(1,n)'] as const;
export const VISOES_ATRIBUTOS = ['circulos', 'lista'] as const;
export const ESTRATEGIAS_CONVERSAO = [
  'fk_lado_total',
  'fundir',
  'tabela_propria',
  'tabela_por_entidade',
  'tabela_unica',
  'so_especializadas',
] as const;

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
} as const;

export const VERSAO_DOCUMENTO = 2;

const idSchema = z.string().min(1).max(LIMITES.id);
const nomeSchema = z.string().max(LIMITES.nome);
const posicaoSchema = z.object({ x: z.number().finite(), y: z.number().finite() });

const colunaSchema = z.object({
  id: idSchema,
  nome: nomeSchema,
  tipo: z.enum(TIPOS_COLUNA),
  tamanho: z.number().int().min(1).max(LIMITES.tamanhoMaximo).nullable(),
  escala: z.number().int().min(0).max(LIMITES.escalaMaxima).nullable(),
  pk: z.boolean(),
  notNull: z.boolean(),
  unique: z.boolean(),
  autoIncremento: z.boolean(),
  padrao: z.string().max(LIMITES.expressao),
  check: z.string().max(LIMITES.expressao),
  fk: z.object({ tabelaId: idSchema, colunaId: idSchema }).nullable(),
});

const tabelaSchema = z.object({
  id: idSchema,
  posicao: posicaoSchema,
  nome: nomeSchema,
  colunas: z.array(colunaSchema).max(LIMITES.colunasPorTabela),
});

const notaSchema = z.object({ id: idSchema, posicao: posicaoSchema, texto: z.string().max(LIMITES.texto) });

export const modeloLogicoSchema = z.object({
  tabelas: z.array(tabelaSchema).max(LIMITES.tabelas),
  notas: z.array(notaSchema).max(LIMITES.notas),
});

const baseElemento = { id: idSchema, posicao: posicaoSchema };

const elementoConceitualSchema = z.discriminatedUnion('tipo', [
  z.object({ ...baseElemento, tipo: z.literal('entidade'), nome: nomeSchema }),
  z.object({ ...baseElemento, tipo: z.literal('relacionamento'), nome: nomeSchema, associativa: z.boolean() }),
  z.object({
    ...baseElemento,
    tipo: z.literal('atributo'),
    nome: nomeSchema,
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
  }),
  z.object({ ...baseElemento, tipo: z.literal('especializacao'), paiId: idSchema, total: z.boolean(), disjunta: z.boolean() }),
  z.object({ ...baseElemento, tipo: z.literal('nota'), texto: z.string().max(LIMITES.texto) }),
]);

const ligacaoConceitualSchema = z.discriminatedUnion('tipo', [
  z.object({
    id: idSchema,
    tipo: z.literal('participacao'),
    relacionamentoId: idSchema,
    entidadeId: idSchema,
    min: z.union([z.literal(0), z.literal(1)]),
    max: z.enum(['1', 'n']),
    papel: nomeSchema,
  }),
  z.object({ id: idSchema, tipo: z.literal('filho_especializacao'), especializacaoId: idSchema, entidadeId: idSchema }),
]);

export const modeloConceitualSchema = z.object({
  elementos: z.array(elementoConceitualSchema).max(LIMITES.elementosConceituais),
  ligacoes: z.array(ligacaoConceitualSchema).max(LIMITES.ligacoesConceituais),
  visaoAtributos: z.enum(VISOES_ATRIBUTOS),
});

const conversaoSchema = z.object({
  assinaturaConceitual: z.string().max(LIMITES.id),
  convertidoEm: z.string().max(LIMITES.id),
  escolhas: z.record(z.string().max(LIMITES.id), z.enum(ESTRATEGIAS_CONVERSAO)),
});

export type Coluna = z.infer<typeof colunaSchema>;
export type Tabela = z.infer<typeof tabelaSchema>;
export type ModeloLogico = z.infer<typeof modeloLogicoSchema>;
export type ModeloConceitual = z.infer<typeof modeloConceitualSchema>;
export type ElementoConceitual = ModeloConceitual['elementos'][number];
export type LigacaoConceitual = ModeloConceitual['ligacoes'][number];

export function problemasDoLogico(logico: ModeloLogico): string[] {
  const problemas: string[] = [];
  const ids = new Set<string>();
  const colunasPorTabela = new Map<string, Set<string>>();

  for (const tabela of logico.tabelas) {
    if (ids.has(tabela.id)) problemas.push(`id repetido: ${tabela.id}`);
    ids.add(tabela.id);
    const colunas = new Set<string>();
    for (const coluna of tabela.colunas) {
      if (ids.has(coluna.id)) problemas.push(`id repetido: ${coluna.id}`);
      ids.add(coluna.id);
      colunas.add(coluna.id);
    }
    colunasPorTabela.set(tabela.id, colunas);
  }
  for (const nota of logico.notas) {
    if (ids.has(nota.id)) problemas.push(`id repetido: ${nota.id}`);
    ids.add(nota.id);
  }

  for (const tabela of logico.tabelas) {
    for (const coluna of tabela.colunas) {
      if (coluna.fk && !colunasPorTabela.get(coluna.fk.tabelaId)?.has(coluna.fk.colunaId)) {
        problemas.push(`chave estrangeira aponta para coluna inexistente: ${coluna.id}`);
      }
    }
  }
  return problemas;
}

function temCicloDeAtributos(elementos: ElementoConceitual[]): boolean {
  const paiDoAtributo = new Map<string, string>();
  for (const elemento of elementos) {
    if (elemento.tipo === 'atributo') paiDoAtributo.set(elemento.id, elemento.paiId);
  }
  for (const inicio of paiDoAtributo.keys()) {
    const visitados = new Set<string>();
    let atual: string | undefined = inicio;
    while (atual !== undefined && paiDoAtributo.has(atual)) {
      if (visitados.has(atual)) return true;
      visitados.add(atual);
      atual = paiDoAtributo.get(atual);
    }
  }
  return false;
}

export function problemasDoConceitual(conceitual: ModeloConceitual): string[] {
  const problemas: string[] = [];
  const porId = new Map<string, ElementoConceitual>();

  for (const elemento of conceitual.elementos) {
    if (porId.has(elemento.id)) problemas.push(`id repetido: ${elemento.id}`);
    porId.set(elemento.id, elemento);
  }
  const idsLigacoes = new Set<string>();
  for (const ligacao of conceitual.ligacoes) {
    if (idsLigacoes.has(ligacao.id) || porId.has(ligacao.id)) problemas.push(`id repetido: ${ligacao.id}`);
    idsLigacoes.add(ligacao.id);
  }

  const tipoDe = (id: string): ElementoConceitual['tipo'] | undefined => porId.get(id)?.tipo;
  const ehEntidadeOuAssociativa = (id: string): boolean => {
    const alvo = porId.get(id);
    return alvo?.tipo === 'entidade' || (alvo?.tipo === 'relacionamento' && alvo.associativa);
  };

  for (const elemento of conceitual.elementos) {
    if (elemento.tipo === 'atributo') {
      const tipoPai = tipoDe(elemento.paiId);
      if (tipoPai !== 'entidade' && tipoPai !== 'relacionamento' && tipoPai !== 'atributo') {
        problemas.push(`atributo sem entidade, relacionamento ou atributo pai: ${elemento.id}`);
      }
    }
    if (elemento.tipo === 'especializacao' && tipoDe(elemento.paiId) !== 'entidade') {
      problemas.push(`especialização sem entidade genérica: ${elemento.id}`);
    }
  }

  for (const ligacao of conceitual.ligacoes) {
    if (ligacao.tipo === 'participacao') {
      if (tipoDe(ligacao.relacionamentoId) !== 'relacionamento') {
        problemas.push(`participação sem relacionamento: ${ligacao.id}`);
      }
      if (!ehEntidadeOuAssociativa(ligacao.entidadeId) || ligacao.entidadeId === ligacao.relacionamentoId) {
        problemas.push(`participação sem entidade: ${ligacao.id}`);
      }
    } else {
      if (tipoDe(ligacao.especializacaoId) !== 'especializacao') {
        problemas.push(`filho de especialização sem especialização: ${ligacao.id}`);
      }
      if (tipoDe(ligacao.entidadeId) !== 'entidade') {
        problemas.push(`filho de especialização sem entidade: ${ligacao.id}`);
      }
    }
  }

  if (temCicloDeAtributos(conceitual.elementos)) problemas.push('atributos formam um ciclo');
  return problemas;
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
    ];
    for (const problema of problemas) {
      contexto.addIssue({ code: z.ZodIssueCode.custom, message: `Modelo inconsistente: ${problema}` });
    }
  });

export type DocumentoModelagem = z.infer<typeof documentoModelagemSchema>;

export function documentoTemConteudo(documento: DocumentoModelagem): boolean {
  return (documento.conceitual?.elementos.length ?? 0) > 0 || (documento.logico?.tabelas.length ?? 0) > 0;
}
