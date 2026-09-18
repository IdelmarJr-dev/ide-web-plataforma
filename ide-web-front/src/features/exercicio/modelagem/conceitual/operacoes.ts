import type { ElementoConceitual, LigacaoConceitual, ModeloConceitual } from '../documento'
import { gerarId } from '../documento'

/**
 * Operações puras sobre o modelo conceitual (notação de Chen). Mesma ideia do
 * `logico/operacoes.ts`: o editor só chama estas funções, e as regras (cascata ao
 * remover, papel padrão da participação) ficam aqui, testáveis sem React Flow.
 */

export interface Posicao {
  x: number
  y: number
}

export type EntidadeElemento = Extract<ElementoConceitual, { tipo: 'entidade' }>
export type RelacionamentoElemento = Extract<ElementoConceitual, { tipo: 'relacionamento' }>
export type AtributoElemento = Extract<ElementoConceitual, { tipo: 'atributo' }>
export type EspecializacaoElemento = Extract<ElementoConceitual, { tipo: 'especializacao' }>
export type NotaConceitualElemento = Extract<ElementoConceitual, { tipo: 'nota' }>
export type ParticipacaoLigacao = Extract<LigacaoConceitual, { tipo: 'participacao' }>
export type FilhoEspecializacaoLigacao = Extract<LigacaoConceitual, { tipo: 'filho_especializacao' }>

export type ResultadoOperacaoConceitual = { ok: true; conceitual: ModeloConceitual } | { ok: false; erro: string }

const DESLOCAMENTO_COPIA = 40

function nomeUnico(base: string, existentes: Iterable<string>): string {
  const usados = new Set([...existentes].map((nome) => nome.trim().toLowerCase()))
  const normalizado = base.trim().toLowerCase()
  if (!usados.has(normalizado)) return base
  let sufixo = 2
  while (usados.has(`${base}_${String(sufixo)}`.trim().toLowerCase())) sufixo += 1
  return `${base}_${String(sufixo)}`
}

export function atributosDe(conceitual: ModeloConceitual, paiId: string): AtributoElemento[] {
  return conceitual.elementos.filter((elemento): elemento is AtributoElemento => elemento.tipo === 'atributo' && elemento.paiId === paiId)
}

/** Atributos em profundidade, com o nível de aninhamento — para a visão em lista. */
export function atributosEmArvore(conceitual: ModeloConceitual, paiId: string, nivel = 0): { atributo: AtributoElemento; nivel: number }[] {
  return atributosDe(conceitual, paiId).flatMap((atributo) => [
    { atributo, nivel },
    ...atributosEmArvore(conceitual, atributo.id, nivel + 1),
  ])
}

export function participacoesDe(conceitual: ModeloConceitual, relacionamentoId: string): ParticipacaoLigacao[] {
  return conceitual.ligacoes.filter(
    (ligacao): ligacao is ParticipacaoLigacao => ligacao.tipo === 'participacao' && ligacao.relacionamentoId === relacionamentoId,
  )
}

export function adicionarEntidade(conceitual: ModeloConceitual, posicao: Posicao): { conceitual: ModeloConceitual; id: string } {
  const existentes = conceitual.elementos.filter((elemento): elemento is EntidadeElemento => elemento.tipo === 'entidade')
  const nome = nomeUnico(`entidade${String(existentes.length + 1)}`, existentes.map((elemento) => elemento.nome))
  const entidade: ElementoConceitual = { id: gerarId('entidade'), tipo: 'entidade', posicao, nome }
  return { conceitual: { ...conceitual, elementos: [...conceitual.elementos, entidade] }, id: entidade.id }
}

export function adicionarRelacionamento(conceitual: ModeloConceitual, posicao: Posicao): { conceitual: ModeloConceitual; id: string } {
  const existentes = conceitual.elementos.filter((elemento): elemento is RelacionamentoElemento => elemento.tipo === 'relacionamento')
  const nome = nomeUnico(`relacionamento${String(existentes.length + 1)}`, existentes.map((elemento) => elemento.nome))
  const relacionamento: ElementoConceitual = { id: gerarId('relacionamento'), tipo: 'relacionamento', posicao, nome, associativa: false }
  return { conceitual: { ...conceitual, elementos: [...conceitual.elementos, relacionamento] }, id: relacionamento.id }
}

/** Pai = entidade, relacionamento ou outro atributo (atributo com filhos = atributo composto). */
export function adicionarAtributo(conceitual: ModeloConceitual, paiId: string, posicao: Posicao): { conceitual: ModeloConceitual; id: string } | null {
  const pai = conceitual.elementos.find((elemento) => elemento.id === paiId)
  if (pai?.tipo !== 'entidade' && pai?.tipo !== 'relacionamento' && pai?.tipo !== 'atributo') return null
  const nome = nomeUnico(`atributo${String(atributosDe(conceitual, paiId).length + 1)}`, atributosDe(conceitual, paiId).map((a) => a.nome))
  const atributo: ElementoConceitual = {
    id: gerarId('atributo'),
    tipo: 'atributo',
    posicao,
    nome,
    paiId,
    chave: false,
    cardinalidade: '(1,1)',
    tipoSugerido: null,
  }
  return { conceitual: { ...conceitual, elementos: [...conceitual.elementos, atributo] }, id: atributo.id }
}

export function adicionarNota(conceitual: ModeloConceitual, posicao: Posicao): { conceitual: ModeloConceitual; id: string } {
  const nota: ElementoConceitual = { id: gerarId('nota'), tipo: 'nota', posicao, texto: '' }
  return { conceitual: { ...conceitual, elementos: [...conceitual.elementos, nota] }, id: nota.id }
}

/** Especialização pende de uma entidade genérica; as filhas entram por `criarFilhoEspecializacao`. */
export function adicionarEspecializacao(
  conceitual: ModeloConceitual,
  paiId: string,
  posicao: Posicao,
): { conceitual: ModeloConceitual; id: string } | null {
  const pai = conceitual.elementos.find((elemento) => elemento.id === paiId)
  if (pai?.tipo !== 'entidade') return null
  const especializacao: ElementoConceitual = {
    id: gerarId('especializacao'),
    tipo: 'especializacao',
    posicao,
    paiId,
    total: false,
    disjunta: true,
  }
  return { conceitual: { ...conceitual, elementos: [...conceitual.elementos, especializacao] }, id: especializacao.id }
}

export function especializacoesDe(conceitual: ModeloConceitual, paiId: string): EspecializacaoElemento[] {
  return conceitual.elementos.filter(
    (elemento): elemento is EspecializacaoElemento => elemento.tipo === 'especializacao' && elemento.paiId === paiId,
  )
}

export function filhosDaEspecializacao(conceitual: ModeloConceitual, especializacaoId: string): FilhoEspecializacaoLigacao[] {
  return conceitual.ligacoes.filter(
    (ligacao): ligacao is FilhoEspecializacaoLigacao =>
      ligacao.tipo === 'filho_especializacao' && ligacao.especializacaoId === especializacaoId,
  )
}

export function atualizarEspecializacao(
  conceitual: ModeloConceitual,
  id: string,
  mudancas: Partial<Pick<EspecializacaoElemento, 'total' | 'disjunta'>>,
): ModeloConceitual {
  return {
    ...conceitual,
    elementos: conceitual.elementos.map((elemento) =>
      elemento.id === id && elemento.tipo === 'especializacao' ? { ...elemento, ...mudancas } : elemento,
    ),
  }
}

/** Liga uma entidade especializada à especialização (a genérica é o `paiId` dela). */
export function criarFilhoEspecializacao(
  conceitual: ModeloConceitual,
  especializacaoId: string,
  entidadeId: string,
): ResultadoOperacaoConceitual {
  const especializacao = conceitual.elementos.find((elemento) => elemento.id === especializacaoId)
  const entidade = conceitual.elementos.find((elemento) => elemento.id === entidadeId)
  if (especializacao?.tipo !== 'especializacao') return { ok: false, erro: 'Ligue a especialização a uma entidade.' }
  if (entidade?.tipo !== 'entidade') return { ok: false, erro: 'Só entidades podem ser especializadas.' }
  if (entidade.id === especializacao.paiId) {
    return { ok: false, erro: 'A entidade genérica não pode ser filha da própria especialização.' }
  }
  if (filhosDaEspecializacao(conceitual, especializacaoId).some((ligacao) => ligacao.entidadeId === entidadeId)) {
    return { ok: false, erro: 'Essa entidade já é filha desta especialização.' }
  }
  const ligacao: LigacaoConceitual = { id: gerarId('filho'), tipo: 'filho_especializacao', especializacaoId, entidadeId }
  return { ok: true, conceitual: { ...conceitual, ligacoes: [...conceitual.ligacoes, ligacao] } }
}

/**
 * Entidade associativa: o relacionamento também vira entidade e pode participar de
 * outros relacionamentos. Desmarcar só vale se ninguém depender disso.
 */
export function definirAssociativa(conceitual: ModeloConceitual, id: string, associativa: boolean): ResultadoOperacaoConceitual {
  const relacionamento = conceitual.elementos.find((elemento) => elemento.id === id)
  if (relacionamento?.tipo !== 'relacionamento') return { ok: false, erro: 'Elemento não é um relacionamento.' }
  if (!associativa && conceitual.ligacoes.some((ligacao) => ligacao.tipo === 'participacao' && ligacao.entidadeId === id)) {
    return { ok: false, erro: 'Remova as ligações que tratam este relacionamento como entidade antes de desmarcar.' }
  }
  return {
    ok: true,
    conceitual: {
      ...conceitual,
      elementos: conceitual.elementos.map((elemento) =>
        elemento.id === id && elemento.tipo === 'relacionamento' ? { ...elemento, associativa } : elemento,
      ),
    },
  }
}

/** Renomeia entidade, relacionamento ou atributo (nota usa `atualizarTextoNota`). */
export function renomearElemento(conceitual: ModeloConceitual, id: string, nome: string): ModeloConceitual {
  return {
    ...conceitual,
    elementos: conceitual.elementos.map((elemento) =>
      elemento.id === id && (elemento.tipo === 'entidade' || elemento.tipo === 'relacionamento' || elemento.tipo === 'atributo')
        ? { ...elemento, nome }
        : elemento,
    ),
  }
}

export function moverElemento(conceitual: ModeloConceitual, id: string, posicao: Posicao): ModeloConceitual {
  return { ...conceitual, elementos: conceitual.elementos.map((elemento) => (elemento.id === id ? { ...elemento, posicao } : elemento)) }
}

export function atualizarAtributo(
  conceitual: ModeloConceitual,
  id: string,
  mudancas: Partial<Pick<AtributoElemento, 'nome' | 'chave' | 'cardinalidade' | 'tipoSugerido'>>,
): ModeloConceitual {
  return {
    ...conceitual,
    elementos: conceitual.elementos.map((elemento) => (elemento.id === id && elemento.tipo === 'atributo' ? { ...elemento, ...mudancas } : elemento)),
  }
}

export function atualizarTextoNota(conceitual: ModeloConceitual, id: string, texto: string): ModeloConceitual {
  return {
    ...conceitual,
    elementos: conceitual.elementos.map((elemento) => (elemento.id === id && elemento.tipo === 'nota' ? { ...elemento, texto } : elemento)),
  }
}

export function atualizarParticipacao(
  conceitual: ModeloConceitual,
  id: string,
  mudancas: Partial<Pick<ParticipacaoLigacao, 'min' | 'max' | 'papel'>>,
): ModeloConceitual {
  return {
    ...conceitual,
    ligacoes: conceitual.ligacoes.map((ligacao) => (ligacao.id === id && ligacao.tipo === 'participacao' ? { ...ligacao, ...mudancas } : ligacao)),
  }
}

export function removerLigacao(conceitual: ModeloConceitual, id: string): ModeloConceitual {
  return { ...conceitual, ligacoes: conceitual.ligacoes.filter((ligacao) => ligacao.id !== id) }
}

/**
 * Remove um elemento com cascata: o que pende dele (atributos — inclusive os filhos de
 * um atributo composto — e especializações, em cadeia) e as ligações que o citam.
 */
export function removerElemento(conceitual: ModeloConceitual, id: string): ModeloConceitual {
  const idsARemover = new Set<string>([id])
  let mudou = true
  while (mudou) {
    mudou = false
    for (const elemento of conceitual.elementos) {
      const pendeDeRemovido =
        (elemento.tipo === 'atributo' || elemento.tipo === 'especializacao') && idsARemover.has(elemento.paiId)
      if (pendeDeRemovido && !idsARemover.has(elemento.id)) {
        idsARemover.add(elemento.id)
        mudou = true
      }
    }
  }
  return {
    ...conceitual,
    elementos: conceitual.elementos.filter((elemento) => !idsARemover.has(elemento.id)),
    ligacoes: conceitual.ligacoes.filter((ligacao) =>
      ligacao.tipo === 'participacao'
        ? !idsARemover.has(ligacao.relacionamentoId) && !idsARemover.has(ligacao.entidadeId)
        : !idsARemover.has(ligacao.especializacaoId) && !idsARemover.has(ligacao.entidadeId),
    ),
  }
}

/** Liga um relacionamento a uma entidade (ou entidade associativa). Papel em branco por padrão. */
export function criarParticipacao(conceitual: ModeloConceitual, relacionamentoId: string, entidadeId: string): ResultadoOperacaoConceitual {
  const relacionamento = conceitual.elementos.find((elemento) => elemento.id === relacionamentoId)
  const entidade = conceitual.elementos.find((elemento) => elemento.id === entidadeId)
  if (relacionamento?.tipo !== 'relacionamento') return { ok: false, erro: 'Ligue um relacionamento a uma entidade.' }
  if (entidade?.tipo !== 'entidade' && !(entidade?.tipo === 'relacionamento' && entidade.associativa)) {
    return { ok: false, erro: 'Ligue um relacionamento a uma entidade.' }
  }
  const ligacao: LigacaoConceitual = { id: gerarId('participacao'), tipo: 'participacao', relacionamentoId, entidadeId, min: 0, max: 'n', papel: '' }
  return { ok: true, conceitual: { ...conceitual, ligacoes: [...conceitual.ligacoes, ligacao] } }
}

/** Duplica uma entidade com seus atributos (não duplica participações — mesma regra de `duplicarTabela`). */
export function duplicarEntidade(conceitual: ModeloConceitual, id: string): { conceitual: ModeloConceitual; id: string } | null {
  const original = conceitual.elementos.find((elemento) => elemento.id === id)
  if (original?.tipo !== 'entidade') return null

  const copiaId = gerarId('entidade')
  const atributos = atributosDe(conceitual, id)
  const nomesEntidades = conceitual.elementos.filter((elemento): elemento is EntidadeElemento => elemento.tipo === 'entidade').map((e) => e.nome)
  const copia: ElementoConceitual = {
    ...original,
    id: copiaId,
    nome: nomeUnico(`${original.nome || 'entidade'}_copia`, nomesEntidades),
    posicao: { x: original.posicao.x + DESLOCAMENTO_COPIA, y: original.posicao.y + DESLOCAMENTO_COPIA },
  }
  const copiasAtributos: ElementoConceitual[] = atributos.map((atributo) => ({
    ...atributo,
    id: gerarId('atributo'),
    paiId: copiaId,
    posicao: { x: atributo.posicao.x + DESLOCAMENTO_COPIA, y: atributo.posicao.y + DESLOCAMENTO_COPIA },
  }))
  return { conceitual: { ...conceitual, elementos: [...conceitual.elementos, copia, ...copiasAtributos] }, id: copiaId }
}
