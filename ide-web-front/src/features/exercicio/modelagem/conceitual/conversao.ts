import type {
  Coluna,
  ElementoConceitual,
  EstrategiaConversao,
  LigacaoConceitual,
  ModeloConceitual,
  ModeloLogico,
  Tabela,
  TipoColuna,
} from '../documento'
import { gerarId } from '../documento'
import { normalizarIdentificador } from '../identificadores'
import { atributosDe, filhosDaEspecializacao, participacoesDe } from './operacoes'
import type {
  AtributoElemento,
  EntidadeElemento,
  EspecializacaoElemento,
  ParticipacaoLigacao,
  RelacionamentoElemento,
} from './operacoes'

/**
 * Conversão modelo conceitual → modelo lógico (função pura). Regras em
 * docs/decisions/fase7-modelagem-conceitual-logica.md; os casos ambíguos (1:1) viram
 * `pendencias` pro assistente perguntar. Nunca lança erro: o que não dá pra converter
 * vira aviso.
 *
 * Convenção de cardinalidade (Heuser): o `(mín,máx)` de uma participação diz quantas
 * ocorrências **daquela entidade** se associam a uma ocorrência da outra ponta. Logo a
 * participação de X é total (obrigatória) quando o `mín` **da outra ponta** é 1.
 */

export const ESTRATEGIAS_UM_PARA_UM: readonly EstrategiaConversao[] = ['fk_lado_total', 'fundir', 'tabela_propria']
export const ESTRATEGIAS_ESPECIALIZACAO: readonly EstrategiaConversao[] = ['tabela_por_entidade', 'tabela_unica', 'so_especializadas']

export const ROTULOS_ESTRATEGIA: Record<EstrategiaConversao, string> = {
  fk_lado_total: 'Chave estrangeira no lado obrigatório',
  fundir: 'Fundir as duas entidades numa tabela só',
  tabela_propria: 'Tabela própria para o relacionamento',
  tabela_por_entidade: 'Uma tabela por entidade',
  tabela_unica: 'Tabela única',
  so_especializadas: 'Só as entidades especializadas',
}

export type EscolhasConversao = Record<string, EstrategiaConversao>

export interface PendenciaConversao {
  // Relacionamento 1:1 ou especialização.
  elementoId: string
  // Texto pronto pro assistente ("faz — cliente / endereço").
  rotulo: string
  tipo: 'um_para_um' | 'especializacao'
  opcoes: EstrategiaConversao[]
  escolhaAtual: EstrategiaConversao
  // Por que cada opção resolve o caso, pro aluno entender a escolha.
  explicacoes: Record<string, string>
}

export interface MapaOrigem {
  // Entidade (ou relacionamento com tabela própria) → tabela gerada.
  tabelaPorElemento: Record<string, string>
  // Atributo conceitual → coluna gerada.
  colunaPorAtributo: Record<string, { tabelaId: string; colunaId: string }>
}

export interface ResultadoConversao {
  logico: ModeloLogico
  avisos: string[]
  pendencias: PendenciaConversao[]
  origem: MapaOrigem
}

const ESTRATEGIA_PADRAO_UM_PARA_UM: EstrategiaConversao = 'fk_lado_total'
const ESTRATEGIA_PADRAO_ESPECIALIZACAO: EstrategiaConversao = 'tabela_por_entidade'
const TIPO_PADRAO_CHAVE: TipoColuna = 'INTEGER'
const TIPO_PADRAO_ATRIBUTO: TipoColuna = 'VARCHAR'
const DESLOCAMENTO_TABELA_RELACIONAMENTO = 24
const NOME_COLUNA_TIPO = 'tipo'

function nomeUnico(base: string, existentes: Iterable<string>): string {
  const usados = new Set([...existentes].map(normalizarIdentificador))
  const nome = base || 'coluna'
  if (!usados.has(normalizarIdentificador(nome))) return nome
  let sufixo = 2
  while (usados.has(normalizarIdentificador(`${nome}_${String(sufixo)}`))) sufixo += 1
  return `${nome}_${String(sufixo)}`
}

function ehMultivalorado(atributo: AtributoElemento): boolean {
  return atributo.cardinalidade === '(0,n)' || atributo.cardinalidade === '(1,n)'
}

function colunaDeAtributo(atributo: AtributoElemento): Coluna {
  const sugerido = atributo.tipoSugerido
  return {
    id: atributo.id,
    nome: atributo.nome,
    tipo: sugerido?.tipo ?? (atributo.chave ? TIPO_PADRAO_CHAVE : TIPO_PADRAO_ATRIBUTO),
    tamanho: sugerido?.tamanho ?? null,
    escala: sugerido?.escala ?? null,
    pk: atributo.chave,
    notNull: atributo.chave || atributo.cardinalidade === '(1,1)' || atributo.cardinalidade === '(1,n)',
    unique: false,
    autoIncremento: false,
    padrao: '',
    check: '',
    fk: null,
  }
}

interface ColunaDeAtributo {
  coluna: Coluna
  atributoId: string
}

/**
 * Atributo composto vira colunas achatadas (`endereco` com `rua`/`numero` →
 * `endereco_rua`, `endereco_numero`); o pai não vira coluna. Identificador composto
 * passa o "chave" para as folhas.
 */
function achatarAtributo(
  conceitual: ModeloConceitual,
  atributo: AtributoElemento,
  contexto: { prefixo: string; chaveHerdada: boolean; nomesUsados: string[]; avisos: string[] },
): ColunaDeAtributo[] {
  const nomeCompleto = contexto.prefixo ? `${contexto.prefixo}_${atributo.nome}` : atributo.nome
  const filhos = atributosDe(conceitual, atributo.id)
  const chave = atributo.chave || contexto.chaveHerdada

  if (filhos.length > 0) {
    return filhos.flatMap((filho) =>
      achatarAtributo(conceitual, filho, { ...contexto, prefixo: nomeCompleto, chaveHerdada: chave }),
    )
  }

  if (ehMultivalorado(atributo) && contexto.prefixo) {
    contexto.avisos.push(
      `O atributo "${nomeCompleto}" é multivalorado dentro de um atributo composto; virou uma coluna simples.`,
    )
  }
  const nome = nomeUnico(nomeCompleto, contexto.nomesUsados)
  contexto.nomesUsados.push(nome)
  const coluna = colunaDeAtributo(atributo)
  return [{ coluna: { ...coluna, nome, pk: chave, notNull: coluna.notNull || chave }, atributoId: atributo.id }]
}

/** Colunas de chave estrangeira para a PK de `destino`, uma por parte da chave. */
function colunasFk(
  destino: Tabela,
  opcoes: { prefixo: string; notNull: boolean; unique: boolean; pk: boolean; nomesUsados: string[] },
): Coluna[] {
  const pks = destino.colunas.filter((coluna) => coluna.pk)
  return pks.map((pk) => {
    const base = `${normalizarIdentificador(opcoes.prefixo) || 'ref'}_${normalizarIdentificador(pk.nome) || 'id'}`
    const nome = nomeUnico(base, opcoes.nomesUsados)
    opcoes.nomesUsados.push(nome)
    return {
      id: gerarId('coluna'),
      nome,
      tipo: pk.tipo,
      tamanho: pk.tamanho,
      escala: pk.escala,
      pk: opcoes.pk,
      notNull: opcoes.notNull || opcoes.pk,
      unique: opcoes.unique,
      autoIncremento: false,
      padrao: '',
      check: '',
      fk: { tabelaId: destino.id, colunaId: pk.id },
    }
  })
}

interface RelacionamentoClassificado {
  relacionamento: RelacionamentoElemento
  participacoes: ParticipacaoLigacao[]
  tipo: 'ignorado' | 'um_para_um' | 'um_para_muitos' | 'muitos_para_muitos'
  // Em 1:N: a participação do lado "1" (máx 1) e a do lado "N".
  ladoUm?: ParticipacaoLigacao
  ladoN?: ParticipacaoLigacao
}

function classificar(conceitual: ModeloConceitual, relacionamento: RelacionamentoElemento): RelacionamentoClassificado {
  const participacoes = participacoesDe(conceitual, relacionamento.id)
  if (participacoes.length < 2) return { relacionamento, participacoes, tipo: 'ignorado' }
  if (participacoes.length > 2) return { relacionamento, participacoes, tipo: 'muitos_para_muitos' }

  const [primeira, segunda] = participacoes
  if (!primeira || !segunda) return { relacionamento, participacoes, tipo: 'ignorado' }
  if (primeira.max === '1' && segunda.max === '1') return { relacionamento, participacoes, tipo: 'um_para_um' }
  if (primeira.max === '1') return { relacionamento, participacoes, tipo: 'um_para_muitos', ladoUm: primeira, ladoN: segunda }
  if (segunda.max === '1') return { relacionamento, participacoes, tipo: 'um_para_muitos', ladoUm: segunda, ladoN: primeira }
  return { relacionamento, participacoes, tipo: 'muitos_para_muitos' }
}

/** Fundir só faz sentido quando as duas participações são totais — `(1,1)` dos dois lados. */
function podeFundir(participacoes: ParticipacaoLigacao[]): boolean {
  return participacoes.length === 2 && participacoes.every((participacao) => participacao.min === 1)
}

function nomeDoElemento(elemento: ElementoConceitual | undefined, padrao: string): string {
  if (!elemento) return padrao
  switch (elemento.tipo) {
    case 'entidade':
    case 'relacionamento':
    case 'atributo':
      return elemento.nome || padrao
    default:
      return padrao
  }
}

export function identificarPendencias(conceitual: ModeloConceitual, escolhas: EscolhasConversao = {}): PendenciaConversao[] {
  const relacionamentos = conceitual.elementos.filter((e): e is RelacionamentoElemento => e.tipo === 'relacionamento')
  const pendencias: PendenciaConversao[] = []

  for (const relacionamento of relacionamentos) {
    const classificado = classificar(conceitual, relacionamento)
    if (classificado.tipo !== 'um_para_um') continue

    const nomes = classificado.participacoes.map((participacao) =>
      nomeDoElemento(conceitual.elementos.find((e) => e.id === participacao.entidadeId), 'entidade'),
    )
    const fundirDisponivel = podeFundir(classificado.participacoes)
    const opcoes = ESTRATEGIAS_UM_PARA_UM.filter((opcao) => opcao !== 'fundir' || fundirDisponivel)
    const escolhida = escolhas[relacionamento.id]

    pendencias.push({
      elementoId: relacionamento.id,
      rotulo: `${relacionamento.nome || 'relacionamento'} — ${nomes.join(' / ')}`,
      tipo: 'um_para_um',
      opcoes: [...opcoes],
      escolhaAtual: escolhida && opcoes.includes(escolhida) ? escolhida : ESTRATEGIA_PADRAO_UM_PARA_UM,
      explicacoes: {
        fk_lado_total: 'A chave estrangeira fica na tabela cuja participação é obrigatória, apontando para a outra.',
        fundir: fundirDisponivel
          ? 'As duas entidades viram uma tabela só (as duas participações são obrigatórias).'
          : 'Indisponível: só vale quando as duas participações são obrigatórias.',
        tabela_propria: 'O relacionamento vira uma tabela com as duas chaves estrangeiras.',
      },
    })
  }

  for (const especializacao of conceitual.elementos.filter((e): e is EspecializacaoElemento => e.tipo === 'especializacao')) {
    const filhos = filhosDaEspecializacao(conceitual, especializacao.id)
    if (filhos.length === 0) continue

    const generica = nomeDoElemento(conceitual.elementos.find((e) => e.id === especializacao.paiId), 'entidade')
    const nomesFilhos = filhos.map((ligacao) => nomeDoElemento(conceitual.elementos.find((e) => e.id === ligacao.entidadeId), 'entidade'))
    // Sem tabela da genérica, toda ocorrência precisa estar em alguma filha: só se for total.
    const opcoes = ESTRATEGIAS_ESPECIALIZACAO.filter((opcao) => opcao !== 'so_especializadas' || especializacao.total)
    const escolhida = escolhas[especializacao.id]

    pendencias.push({
      elementoId: especializacao.id,
      rotulo: `${generica} → ${nomesFilhos.join(' / ')}`,
      tipo: 'especializacao',
      opcoes: [...opcoes],
      escolhaAtual: escolhida && opcoes.includes(escolhida) ? escolhida : ESTRATEGIA_PADRAO_ESPECIALIZACAO,
      explicacoes: {
        tabela_por_entidade: `Uma tabela para "${generica}" e uma para cada especializada, ligadas pela chave da genérica.`,
        tabela_unica: `Tudo numa tabela "${generica}", com as colunas das especializadas opcionais e uma coluna "${NOME_COLUNA_TIPO}".`,
        so_especializadas: especializacao.total
          ? `Sem tabela para "${generica}": cada especializada recebe uma cópia das colunas dela.`
          : 'Indisponível: só vale quando a especialização é total.',
      },
    })
  }
  return pendencias
}

interface Multivalorado {
  donoId: string
  atributo: AtributoElemento
}

interface Construcao {
  tabelas: Map<string, Tabela>
  // Entidade (ou relacionamento associativo) → tabela onde ela vive hoje; muda com fusão
  // e com especialização em tabela única.
  tabelaDaEntidade: Map<string, string>
  // Atributos multivalorados viram tabela própria no fim, quando o dono já tem PK final.
  multivalorados: Multivalorado[]
  avisos: string[]
  origem: MapaOrigem
}

function tabelaDe(construcao: Construcao, entidadeId: string): Tabela | undefined {
  const tabelaId = construcao.tabelaDaEntidade.get(entidadeId)
  return tabelaId === undefined ? undefined : construcao.tabelas.get(tabelaId)
}

function acrescentarColunas(construcao: Construcao, tabelaId: string, colunas: Coluna[]): void {
  const tabela = construcao.tabelas.get(tabelaId)
  if (!tabela) return
  construcao.tabelas.set(tabelaId, { ...tabela, colunas: [...tabela.colunas, ...colunas] })
}

/**
 * Colunas dos atributos diretos de um elemento: compostos achatados, multivalorados
 * separados pra virarem tabela depois.
 */
function colunasDosAtributos(
  conceitual: ModeloConceitual,
  donoId: string,
  construcao: Construcao,
  nomesUsados: string[],
): ColunaDeAtributo[] {
  const colunas: ColunaDeAtributo[] = []
  for (const atributo of atributosDe(conceitual, donoId)) {
    if (ehMultivalorado(atributo)) {
      construcao.multivalorados.push({ donoId, atributo })
      continue
    }
    colunas.push(
      ...achatarAtributo(conceitual, atributo, {
        prefixo: '',
        chaveHerdada: false,
        nomesUsados,
        avisos: construcao.avisos,
      }),
    )
  }
  return colunas
}

/** Atributos do relacionamento entram na tabela que recebeu a chave estrangeira. */
function colunasDoRelacionamento(
  conceitual: ModeloConceitual,
  construcao: Construcao,
  relacionamento: RelacionamentoElemento,
  nomesUsados: string[],
): Coluna[] {
  // Atributo de relacionamento nunca é chave da tabela que o recebe.
  return colunasDosAtributos(conceitual, relacionamento.id, construcao, nomesUsados).map(({ coluna }) => ({
    ...coluna,
    pk: false,
  }))
}

function chaveSubstituta(nomesUsados: string[]): Coluna {
  const nome = nomeUnico('id', nomesUsados)
  nomesUsados.push(nome)
  return {
    id: gerarId('coluna'),
    nome,
    tipo: TIPO_PADRAO_CHAVE,
    tamanho: null,
    escala: null,
    pk: true,
    notNull: true,
    unique: false,
    autoIncremento: true,
    padrao: '',
    check: '',
    fk: null,
  }
}

function converterEntidades(conceitual: ModeloConceitual, construcao: Construcao, especializadas: Set<string>): void {
  const entidades = conceitual.elementos.filter((e): e is EntidadeElemento => e.tipo === 'entidade')

  for (const entidade of entidades) {
    const nomesUsados: string[] = []
    const colunasDeAtributos = colunasDosAtributos(conceitual, entidade.id, construcao, nomesUsados)
    const colunas = colunasDeAtributos.map(({ coluna }) => coluna)

    // Entidade especializada herda a chave da genérica; a chave substituta sairia sobrando.
    if (!colunas.some((coluna) => coluna.pk) && !especializadas.has(entidade.id)) {
      const substituta = chaveSubstituta(nomesUsados)
      colunas.unshift(substituta)
      construcao.avisos.push(
        `A entidade "${entidade.nome || 'sem nome'}" não tem atributo identificador; a tabela ganhou uma chave "${substituta.nome}".`,
      )
    }

    construcao.tabelas.set(entidade.id, {
      id: entidade.id,
      posicao: entidade.posicao,
      nome: entidade.nome || 'entidade',
      colunas,
    })
    construcao.tabelaDaEntidade.set(entidade.id, entidade.id)
    construcao.origem.tabelaPorElemento[entidade.id] = entidade.id
    for (const { coluna, atributoId } of colunasDeAtributos) {
      construcao.origem.colunaPorAtributo[atributoId] = { tabelaId: entidade.id, colunaId: coluna.id }
    }
  }
}

function fundir(conceitual: ModeloConceitual, construcao: Construcao, classificado: RelacionamentoClassificado): void {
  const [primeira, segunda] = classificado.participacoes
  if (!primeira || !segunda) return
  const principal = tabelaDe(construcao, primeira.entidadeId)
  const absorvida = tabelaDe(construcao, segunda.entidadeId)
  if (!principal || !absorvida || principal.id === absorvida.id) return

  const nomesUsados = principal.colunas.map((coluna) => coluna.nome)
  const migradas = absorvida.colunas.map((coluna) => {
    const nome = nomeUnico(coluna.nome, nomesUsados)
    nomesUsados.push(nome)
    // A chave da entidade absorvida vira só uma coluna única: a tabela fundida tem uma PK só.
    return coluna.pk ? { ...coluna, nome, pk: false, unique: true, notNull: true } : { ...coluna, nome }
  })

  construcao.tabelas.set(principal.id, { ...principal, colunas: [...principal.colunas, ...migradas] })
  construcao.tabelas.delete(absorvida.id)

  for (const [entidadeId, tabelaId] of construcao.tabelaDaEntidade) {
    if (tabelaId === absorvida.id) {
      construcao.tabelaDaEntidade.set(entidadeId, principal.id)
      construcao.origem.tabelaPorElemento[entidadeId] = principal.id
    }
  }
  for (const coluna of migradas) {
    if (construcao.origem.colunaPorAtributo[coluna.id]) {
      construcao.origem.colunaPorAtributo[coluna.id] = { tabelaId: principal.id, colunaId: coluna.id }
    }
  }

  acrescentarColunas(
    construcao,
    principal.id,
    colunasDoRelacionamento(conceitual, construcao, classificado.relacionamento, nomesUsados),
  )
  construcao.avisos.push(
    `"${principal.nome}" e "${absorvida.nome}" foram fundidas numa tabela só, como você escolheu no assistente.`,
  )
}

/**
 * Especialização. `tabela_por_entidade`: cada especializada recebe a chave da genérica
 * como PK. `tabela_unica`: tudo na genérica, com coluna "tipo" e colunas opcionais.
 * `so_especializadas` (só se total): a genérica some e cada filha copia as colunas dela.
 */
function converterEspecializacao(
  construcao: Construcao,
  especializacao: EspecializacaoElemento,
  filhosIds: string[],
  estrategia: EstrategiaConversao,
): void {
  const generica = tabelaDe(construcao, especializacao.paiId)
  if (!generica) return
  const filhas = filhosIds
    .map((entidadeId) => ({ entidadeId, tabela: tabelaDe(construcao, entidadeId) }))
    .filter((filha): filha is { entidadeId: string; tabela: Tabela } => filha.tabela !== undefined)
  if (filhas.length === 0) return

  if (estrategia === 'tabela_unica') {
    const nomesUsados = generica.colunas.map((coluna) => coluna.nome)
    const migradas: Coluna[] = []
    for (const filha of filhas) {
      for (const coluna of filha.tabela.colunas) {
        const nome = nomeUnico(coluna.nome, nomesUsados)
        nomesUsados.push(nome)
        // Coluna de especializada não vale para toda ocorrência: fica opcional.
        migradas.push({ ...coluna, nome, pk: false, notNull: false })
        if (construcao.origem.colunaPorAtributo[coluna.id]) {
          construcao.origem.colunaPorAtributo[coluna.id] = { tabelaId: generica.id, colunaId: coluna.id }
        }
      }
      construcao.tabelas.delete(filha.tabela.id)
      construcao.tabelaDaEntidade.set(filha.entidadeId, generica.id)
      construcao.origem.tabelaPorElemento[filha.entidadeId] = generica.id
    }
    const nomeTipo = nomeUnico(NOME_COLUNA_TIPO, nomesUsados)
    migradas.push({
      id: gerarId('coluna'),
      nome: nomeTipo,
      tipo: TIPO_PADRAO_ATRIBUTO,
      tamanho: null,
      escala: null,
      pk: false,
      notNull: especializacao.total,
      unique: false,
      autoIncremento: false,
      padrao: '',
      check: '',
      fk: null,
    })
    acrescentarColunas(construcao, generica.id, migradas)
    construcao.avisos.push(
      `A especialização de "${generica.nome}" virou uma tabela só; a coluna "${nomeTipo}" diz qual é o tipo de cada linha.`,
    )
    return
  }

  if (estrategia === 'so_especializadas') {
    for (const filha of filhas) {
      const nomesUsados = filha.tabela.colunas.map((coluna) => coluna.nome)
      // Cópia com id novo: a mesma coluna passa a existir em várias tabelas.
      const copiadas = generica.colunas.map((coluna) => ({
        ...coluna,
        id: gerarId('coluna'),
        nome: nomeUnico(coluna.nome, nomesUsados),
      }))
      copiadas.forEach((coluna) => nomesUsados.push(coluna.nome))
      construcao.tabelas.set(filha.tabela.id, { ...filha.tabela, colunas: [...copiadas, ...filha.tabela.colunas] })
    }
    construcao.tabelas.delete(generica.id)
    construcao.tabelaDaEntidade.delete(especializacao.paiId)
    construcao.avisos.push(
      `"${generica.nome}" não virou tabela: cada especializada recebeu uma cópia das colunas dela, como você escolheu no assistente.`,
    )
    return
  }

  for (const filha of filhas) {
    const nomesUsados = filha.tabela.colunas.map((coluna) => coluna.nome)
    const herdadas = colunasFk(generica, { prefixo: generica.nome, notNull: true, unique: false, pk: true, nomesUsados })
    const proprias = filha.tabela.colunas.map((coluna) =>
      // A chave herdada é a PK da especializada; a chave própria vira coluna única.
      coluna.pk ? { ...coluna, pk: false, unique: true, notNull: true } : coluna,
    )
    if (proprias.some((coluna) => coluna.unique && !coluna.fk)) {
      construcao.avisos.push(
        `"${filha.tabela.nome}" herdou a chave de "${generica.nome}"; o identificador próprio dela virou coluna única.`,
      )
    }
    construcao.tabelas.set(filha.tabela.id, { ...filha.tabela, colunas: [...herdadas, ...proprias] })
  }
}

/** Relacionamento marcado como entidade associativa vira tabela antes dos demais. */
function tabelaDaAssociativa(conceitual: ModeloConceitual, construcao: Construcao, classificado: RelacionamentoClassificado): void {
  tabelaDoRelacionamento(conceitual, construcao, classificado, { unique: false })
  const tabela = construcao.tabelas.get(classificado.relacionamento.id)
  if (!tabela) return
  // A partir daqui o relacionamento é referenciável como se fosse entidade.
  construcao.tabelaDaEntidade.set(classificado.relacionamento.id, tabela.id)
}

/** Atributo multivalorado vira tabela `<dono>_<atributo>` com a chave do dono + o valor. */
function tabelaDoMultivalorado(conceitual: ModeloConceitual, construcao: Construcao, { donoId, atributo }: Multivalorado): void {
  const dono = tabelaDe(construcao, donoId)
  if (!dono?.colunas.some((coluna) => coluna.pk)) {
    construcao.avisos.push(`O atributo multivalorado "${atributo.nome || 'sem nome'}" não virou tabela: o dono ficou sem chave primária.`)
    return
  }

  const nomesUsados: string[] = []
  const chaveDono = colunasFk(dono, { prefixo: dono.nome, notNull: true, unique: false, pk: true, nomesUsados })
  const valores = achatarAtributo(conceitual, atributo, {
    prefixo: '',
    chaveHerdada: false,
    nomesUsados,
    avisos: construcao.avisos,
  }).map(({ coluna, atributoId }) => ({ coluna: { ...coluna, pk: true, notNull: true }, atributoId }))

  const nome = `${normalizarIdentificador(dono.nome) || 'tabela'}_${normalizarIdentificador(atributo.nome) || 'valores'}`
  // Id próprio: a coluna de valor já usa o id do atributo, e id repetido quebra o documento.
  const tabelaId = gerarId('tabela')
  construcao.tabelas.set(tabelaId, {
    id: tabelaId,
    posicao: { x: atributo.posicao.x, y: atributo.posicao.y },
    nome,
    colunas: [...chaveDono, ...valores.map(({ coluna }) => coluna)],
  })
  construcao.origem.tabelaPorElemento[atributo.id] = tabelaId
  for (const { coluna, atributoId } of valores) {
    construcao.origem.colunaPorAtributo[atributoId] = { tabelaId, colunaId: coluna.id }
  }
}

/** Põe a FK na tabela de `participacaoDona`, apontando para a tabela da outra ponta. */
function ligarComFk(
  conceitual: ModeloConceitual,
  construcao: Construcao,
  classificado: RelacionamentoClassificado,
  participacaoDona: ParticipacaoLigacao,
  participacaoAlvo: ParticipacaoLigacao,
  unique: boolean,
): void {
  const dona = tabelaDe(construcao, participacaoDona.entidadeId)
  const alvo = tabelaDe(construcao, participacaoAlvo.entidadeId)
  if (!dona || !alvo) return
  if (!alvo.colunas.some((coluna) => coluna.pk)) {
    construcao.avisos.push(`"${alvo.nome}" ficou sem chave primária; o relacionamento "${classificado.relacionamento.nome}" não virou chave estrangeira.`)
    return
  }

  const nomesUsados = dona.colunas.map((coluna) => coluna.nome)
  const prefixo = participacaoAlvo.papel || alvo.nome
  const colunas = colunasFk(alvo, {
    prefixo,
    // Participação de X é total quando o mínimo da outra ponta é 1.
    notNull: participacaoAlvo.min === 1,
    unique,
    pk: false,
    nomesUsados,
  })
  acrescentarColunas(construcao, dona.id, [
    ...colunas,
    ...colunasDoRelacionamento(conceitual, construcao, classificado.relacionamento, nomesUsados),
  ])
}

function tabelaDoRelacionamento(
  conceitual: ModeloConceitual,
  construcao: Construcao,
  classificado: RelacionamentoClassificado,
  opcoes: { unique: boolean },
): void {
  const { relacionamento, participacoes } = classificado
  const nomesUsados: string[] = []
  const colunas: Coluna[] = []
  const pkPorMaximo = participacoes.some((participacao) => participacao.max === 'n')

  for (const participacao of participacoes) {
    const alvo = tabelaDe(construcao, participacao.entidadeId)
    if (!alvo?.colunas.some((coluna) => coluna.pk)) {
      construcao.avisos.push(
        `Uma ponta de "${relacionamento.nome || 'relacionamento'}" ficou sem chave primária e não virou chave estrangeira.`,
      )
      continue
    }
    colunas.push(
      ...colunasFk(alvo, {
        prefixo: participacao.papel || alvo.nome,
        notNull: true,
        unique: opcoes.unique,
        // PK da tabela do relacionamento = as pernas com máximo "n" (ou todas, se não houver).
        pk: !opcoes.unique && (!pkPorMaximo || participacao.max === 'n'),
        nomesUsados,
      }),
    )
  }

  colunas.push(...colunasDoRelacionamento(conceitual, construcao, relacionamento, nomesUsados))
  if (colunas.length === 0) return

  // 1:1 com tabela própria: a primeira chave estrangeira serve de chave primária.
  if (opcoes.unique) {
    const primeiraFk = colunas.find((coluna) => coluna.fk !== null)
    if (primeiraFk) primeiraFk.pk = true
  }

  construcao.tabelas.set(relacionamento.id, {
    id: relacionamento.id,
    posicao: {
      x: relacionamento.posicao.x + DESLOCAMENTO_TABELA_RELACIONAMENTO,
      y: relacionamento.posicao.y + DESLOCAMENTO_TABELA_RELACIONAMENTO,
    },
    nome: relacionamento.nome || 'relacionamento',
    colunas,
  })
  construcao.origem.tabelaPorElemento[relacionamento.id] = relacionamento.id
  for (const coluna of colunas) {
    if (coluna.fk === null) {
      construcao.origem.colunaPorAtributo[coluna.id] = { tabelaId: relacionamento.id, colunaId: coluna.id }
    }
  }
}

function converterUmParaUm(
  conceitual: ModeloConceitual,
  construcao: Construcao,
  classificado: RelacionamentoClassificado,
  escolha: EstrategiaConversao,
): void {
  const [primeira, segunda] = classificado.participacoes
  if (!primeira || !segunda) return

  if (escolha === 'tabela_propria') {
    tabelaDoRelacionamento(conceitual, construcao, classificado, { unique: true })
    return
  }

  // Participação de X é total quando o mínimo da OUTRA ponta é 1: a FK fica no lado total.
  const primeiraEhTotal = segunda.min === 1
  const segundaEhTotal = primeira.min === 1
  let dona = primeira
  let alvo = segunda
  if (segundaEhTotal && !primeiraEhTotal) {
    dona = segunda
    alvo = primeira
  } else if (primeiraEhTotal === segundaEhTotal) {
    construcao.avisos.push(
      `Em "${classificado.relacionamento.nome || 'relacionamento'}" os dois lados têm a mesma obrigatoriedade; ` +
        'a chave estrangeira ficou no primeiro lado ligado.',
    )
  }
  ligarComFk(conceitual, construcao, classificado, dona, alvo, true)
}

/**
 * Ordem das passagens: entidades → especializações (definem a PK das filhas) →
 * associativas (viram tabela referenciável) → fusões → demais relacionamentos →
 * multivalorados (precisam da PK final do dono).
 */
export function converter(conceitual: ModeloConceitual, escolhas: EscolhasConversao = {}): ResultadoConversao {
  const construcao: Construcao = {
    tabelas: new Map(),
    tabelaDaEntidade: new Map(),
    multivalorados: [],
    avisos: [],
    origem: { tabelaPorElemento: {}, colunaPorAtributo: {} },
  }

  const especializacoes = conceitual.elementos.filter((e): e is EspecializacaoElemento => e.tipo === 'especializacao')
  const filhosPorEspecializacao = new Map(
    especializacoes.map((especializacao) => [
      especializacao.id,
      filhosDaEspecializacao(conceitual, especializacao.id).map((ligacao) => ligacao.entidadeId),
    ]),
  )
  const especializadas = new Set([...filhosPorEspecializacao.values()].flat())

  converterEntidades(conceitual, construcao, especializadas)

  for (const especializacao of especializacoes) {
    const filhos = filhosPorEspecializacao.get(especializacao.id) ?? []
    if (filhos.length === 0) {
      construcao.avisos.push('Uma especialização não tem entidades filhas ligadas e foi ignorada.')
      continue
    }
    const escolhida = escolhas[especializacao.id] ?? ESTRATEGIA_PADRAO_ESPECIALIZACAO
    const valida =
      escolhida === 'so_especializadas' && !especializacao.total ? ESTRATEGIA_PADRAO_ESPECIALIZACAO : escolhida
    if (valida !== escolhida) {
      construcao.avisos.push(
        'Só dá para dispensar a tabela da entidade genérica quando a especialização é total; foi convertida com uma tabela por entidade.',
      )
    }
    converterEspecializacao(construcao, especializacao, filhos, valida)
  }

  const relacionamentos = conceitual.elementos.filter((e): e is RelacionamentoElemento => e.tipo === 'relacionamento')
  const classificados = relacionamentos.map((relacionamento) => classificar(conceitual, relacionamento))

  for (const classificado of classificados) {
    if (classificado.tipo === 'ignorado') {
      construcao.avisos.push(
        `O relacionamento "${classificado.relacionamento.nome || 'sem nome'}" precisa de duas entidades ligadas para virar tabela ou chave estrangeira.`,
      )
    }
  }

  // Associativas antes: outros relacionamentos apontam FK para a tabela delas.
  for (const classificado of classificados) {
    if (classificado.relacionamento.associativa && classificado.tipo !== 'ignorado') {
      tabelaDaAssociativa(conceitual, construcao, classificado)
    }
  }

  // Fusões: quem referencia uma entidade fundida precisa achar a tabela que sobrou.
  for (const classificado of classificados) {
    if (classificado.relacionamento.associativa) continue
    const escolha = escolhas[classificado.relacionamento.id] ?? ESTRATEGIA_PADRAO_UM_PARA_UM
    if (classificado.tipo === 'um_para_um' && escolha === 'fundir') {
      if (podeFundir(classificado.participacoes)) fundir(conceitual, construcao, classificado)
      else {
        construcao.avisos.push(
          `"${classificado.relacionamento.nome || 'relacionamento'}" só pode ser fundido quando as duas participações são obrigatórias; ` +
            'foi convertido com chave estrangeira.',
        )
      }
    }
  }

  for (const classificado of classificados) {
    if (classificado.relacionamento.associativa) continue
    const escolha = escolhas[classificado.relacionamento.id] ?? ESTRATEGIA_PADRAO_UM_PARA_UM
    switch (classificado.tipo) {
      case 'ignorado':
        break
      case 'um_para_um':
        if (escolha === 'fundir' && podeFundir(classificado.participacoes)) break
        converterUmParaUm(conceitual, construcao, classificado, escolha === 'fundir' ? ESTRATEGIA_PADRAO_UM_PARA_UM : escolha)
        break
      case 'um_para_muitos': {
        const { ladoUm, ladoN } = classificado
        if (ladoUm && ladoN) ligarComFk(conceitual, construcao, classificado, ladoN, ladoUm, false)
        break
      }
      case 'muitos_para_muitos':
        tabelaDoRelacionamento(conceitual, construcao, classificado, { unique: false })
        break
    }
  }

  for (const multivalorado of construcao.multivalorados) {
    tabelaDoMultivalorado(conceitual, construcao, multivalorado)
  }

  // Anotações do conceitual acompanham o lógico.
  const notas = conceitual.elementos
    .filter((elemento) => elemento.tipo === 'nota')
    .map((nota) => ({ id: nota.id, posicao: nota.posicao, texto: nota.texto }))

  return {
    logico: { tabelas: [...construcao.tabelas.values()], notas },
    avisos: construcao.avisos,
    pendencias: identificarPendencias(conceitual, escolhas),
    origem: construcao.origem,
  }
}

const HASH_INICIAL = 2166136261
const HASH_PRIMO = 16777619
const BASE_TEXTO = 36

function hashTexto(texto: string): string {
  let hash = HASH_INICIAL
  for (let indice = 0; indice < texto.length; indice += 1) {
    hash ^= texto.charCodeAt(indice)
    hash = Math.imul(hash, HASH_PRIMO)
  }
  return (hash >>> 0).toString(BASE_TEXTO)
}

function descreverElemento(elemento: ElementoConceitual): string | null {
  switch (elemento.tipo) {
    case 'entidade':
      return `entidade|${elemento.id}|${elemento.nome}`
    case 'relacionamento':
      return `relacionamento|${elemento.id}|${elemento.nome}|${String(elemento.associativa)}`
    case 'atributo': {
      const sugerido = elemento.tipoSugerido
      const tipo = sugerido ? `${sugerido.tipo}:${String(sugerido.tamanho)}:${String(sugerido.escala)}` : '-'
      return `atributo|${elemento.id}|${elemento.nome}|${elemento.paiId}|${String(elemento.chave)}|${elemento.cardinalidade}|${tipo}`
    }
    case 'especializacao':
      return `especializacao|${elemento.id}|${elemento.paiId}|${String(elemento.total)}|${String(elemento.disjunta)}`
    // Nota não muda o lógico: não entra na assinatura.
    case 'nota':
      return null
  }
}

function descreverLigacao(ligacao: LigacaoConceitual): string {
  return ligacao.tipo === 'participacao'
    ? `participacao|${ligacao.id}|${ligacao.relacionamentoId}|${ligacao.entidadeId}|${String(ligacao.min)}|${ligacao.max}|${ligacao.papel}`
    : `filho|${ligacao.id}|${ligacao.especializacaoId}|${ligacao.entidadeId}`
}

/**
 * Impressão digital do conceitual, sem posições nem notas: muda quando muda alguma
 * coisa que afeta a conversão. Serve pro aviso "o conceitual mudou desde a conversão".
 */
export function assinaturaConceitual(conceitual: ModeloConceitual): string {
  const partes = [
    ...conceitual.elementos.map(descreverElemento).filter((parte): parte is string => parte !== null),
    ...conceitual.ligacoes.map(descreverLigacao),
  ].sort()
  return hashTexto(partes.join('\n'))
}
