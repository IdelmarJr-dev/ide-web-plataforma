import { useState } from 'react'
import type { ReactNode } from 'react'
import type { CardinalidadeAtributo, ElementoConceitual, ModeloConceitual, TipoColuna } from '../../../modelagem/documento'
import { CARDINALIDADES_ATRIBUTO, TIPOS_COLUNA, TIPOS_COM_TAMANHO } from '../../../modelagem/documento'
import type { SelecaoConceitual } from '../../../modelagem/conceitual/editorContexto'
import {
  atributosDe,
  atualizarAtributo,
  atualizarEspecializacao,
  atualizarParticipacao,
  atualizarTextoNota,
  definirAssociativa,
  duplicarEntidade,
  especializacoesDe,
  filhosDaEspecializacao,
  participacoesDe,
  removerElemento,
  removerLigacao,
  renomearElemento,
} from '../../../modelagem/conceitual/operacoes'
import type { AtributoElemento } from '../../../modelagem/conceitual/operacoes'

type Atualizacao = (conceitual: ModeloConceitual) => ModeloConceitual

interface PainelPropriedadesConceitualProps {
  conceitual: ModeloConceitual
  selecao: SelecaoConceitual | null
  somenteLeitura: boolean
  onAplicar: (atualizar: Atualizacao, chave?: string) => void
  onEncerrarGesto: () => void
  onSelecionar: (selecao: SelecaoConceitual | null) => void
  onAdicionarAtributo: (paiId: string) => void
  onAdicionarEspecializacao: (paiId: string) => void
}

const CLASSE_CAMPO =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:bg-neutral-50'
const CLASSE_BOTAO_TEXTO = 'text-xs font-medium text-primary-600 hover:underline disabled:text-neutral-400 disabled:no-underline'
const CLASSE_BOTAO_PERIGO = 'text-xs font-medium text-danger-600 hover:underline'

const Campo = ({ rotulo, children }: { rotulo: string; children: ReactNode }): ReactNode => (
  <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
    {rotulo}
    {children}
  </label>
)

const Caixa = ({ rotulo, marcado, dica, onChange }: { rotulo: string; marcado: boolean; dica?: string; onChange: (marcado: boolean) => void }): ReactNode => (
  <label className="flex items-center gap-2 text-sm text-neutral-800" title={dica}>
    <input type="checkbox" checked={marcado} onChange={(evento) => { onChange(evento.target.checked) }} className="h-4 w-4 accent-primary-600" />
    {rotulo}
  </label>
)

const Titulo = ({ children }: { children: ReactNode }): ReactNode => (
  <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{children}</h3>
)

/** `.nome` só existe em entidade/relacionamento/atributo — nota e especialização não têm. */
function nomeDoElemento(elemento: ElementoConceitual | undefined): string {
  if (!elemento) return ''
  switch (elemento.tipo) {
    case 'entidade':
    case 'relacionamento':
    case 'atributo':
      return elemento.nome
    default:
      return ''
  }
}

const Orientacao = (): ReactNode => (
  <div className="flex flex-col gap-3 text-xs text-neutral-700">
    <Titulo>Modelo conceitual (Chen)</Titulo>
    <p>Adicione entidades e relacionamentos pela paleta. Clique num elemento para editar aqui.</p>
    <p>
      <strong>Atributo:</strong> selecione uma entidade ou relacionamento e use &quot;+ atributo&quot;, ou arraste o
      item da paleta até soltar sobre o elemento.
    </p>
    <p>
      <strong>Participação:</strong> arraste da alça de um relacionamento até uma entidade (ou o contrário).
      Auto-relacionamento: ligue a mesma entidade duas vezes e distinga com o papel de cada lado.
    </p>
    <p>
      <strong>(mín,máx)</strong> junto da entidade indica com quantas ocorrências dela uma ocorrência do
      relacionamento se associa.
    </p>
    <p>
      <strong>Especialização:</strong> selecione a entidade genérica, use &quot;+ especialização&quot; e arraste da alça
      do triângulo até cada entidade especializada.
    </p>
    <p>
      <strong>Composto:</strong> um atributo pode ter subatributos. <strong>Multivalorado:</strong> use a cardinalidade
      (0,n) ou (1,n) — vira tabela própria na conversão.
    </p>
    <p className="text-neutral-500">Atalhos com o foco no desenho: Delete exclui, Ctrl+Z desfaz, Ctrl+Y refaz, Ctrl+D duplica (entidade).</p>
  </div>
)

const ListaAtributos = ({
  atributos,
  somenteLeitura,
  rotulo = 'Atributos',
  onSelecionar,
  onAdicionar,
}: {
  atributos: AtributoElemento[]
  somenteLeitura: boolean
  rotulo?: string
  onSelecionar: (id: string) => void
  onAdicionar: () => void
}): ReactNode => (
  <div className="flex flex-col gap-1">
    <p className="text-xs font-medium text-neutral-700">{rotulo}</p>
    {atributos.length === 0 ? (
      <p className="text-xs italic text-neutral-500">nenhum atributo ainda</p>
    ) : (
      <ul className="flex flex-col divide-y divide-neutral-100 rounded-md border border-neutral-200">
        {atributos.map((atributo) => (
          <li key={atributo.id}>
            <button
              type="button"
              className="block w-full truncate px-2 py-1 text-left text-sm text-neutral-900 hover:text-primary-700"
              onClick={() => { onSelecionar(atributo.id) }}
            >
              {atributo.chave ? '🔑 ' : ''}
              <span className={atributo.chave ? 'underline' : ''}>{atributo.nome || 'atributo sem nome'}</span>
            </button>
          </li>
        ))}
      </ul>
    )}
    {somenteLeitura ? null : (
      <button type="button" className={`${CLASSE_BOTAO_TEXTO} self-start`} onClick={onAdicionar}>
        {rotulo === 'Atributos' ? '+ atributo' : '+ subatributo'}
      </button>
    )}
  </div>
)

export const PainelPropriedadesConceitual = ({
  conceitual,
  selecao,
  somenteLeitura,
  onAplicar,
  onEncerrarGesto,
  onSelecionar,
  onAdicionarAtributo,
  onAdicionarEspecializacao,
}: PainelPropriedadesConceitualProps): ReactNode => {
  // Erro de operação recusada (ex.: desmarcar associativa que outro relacionamento usa).
  const [erro, setErro] = useState<string | null>(null)
  const conteudo = (): ReactNode => {
    if (!selecao) return <Orientacao />

    if (selecao.tipo === 'nota') {
      const nota = conceitual.elementos.find((elemento) => elemento.id === selecao.id && elemento.tipo === 'nota')
      if (nota?.tipo !== 'nota') return <Orientacao />
      return (
        <div className="flex flex-col gap-3">
          <Titulo>Nota</Titulo>
          <Campo rotulo="Texto">
            <textarea
              className={`${CLASSE_CAMPO} h-28 resize-none`}
              value={nota.texto}
              disabled={somenteLeitura}
              onChange={(evento) => { onAplicar((c) => atualizarTextoNota(c, nota.id, evento.target.value), `nota:${nota.id}`) }}
              onBlur={onEncerrarGesto}
            />
          </Campo>
          {somenteLeitura ? null : (
            <button type="button" className={CLASSE_BOTAO_PERIGO} onClick={() => { onAplicar((c) => removerElemento(c, nota.id)); onSelecionar(null) }}>
              Excluir nota
            </button>
          )}
        </div>
      )
    }

    if (selecao.tipo === 'participacao') {
      const ligacao = conceitual.ligacoes.find((existente) => existente.id === selecao.id)
      const relacionamento = conceitual.elementos.find((elemento) => elemento.id === (ligacao?.tipo === 'participacao' ? ligacao.relacionamentoId : undefined))
      const entidade = conceitual.elementos.find((elemento) => elemento.id === (ligacao?.tipo === 'participacao' ? ligacao.entidadeId : undefined))
      if (ligacao?.tipo !== 'participacao' || !relacionamento || !entidade) return <Orientacao />
      const mudar = (mudancas: Partial<Pick<typeof ligacao, 'min' | 'max' | 'papel'>>, chave?: string): void => {
        onAplicar((c) => atualizarParticipacao(c, ligacao.id, mudancas), chave)
      }
      const nomeRelacionamento = nomeDoElemento(relacionamento) || 'relacionamento'
      const nomeEntidade = nomeDoElemento(entidade) || 'entidade'
      return (
        <div className="flex flex-col gap-3 text-sm">
          <Titulo>Participação</Titulo>
          <p className="text-xs text-neutral-800">
            <strong>{nomeRelacionamento}</strong> ↔ <strong>{nomeEntidade}</strong>
          </p>
          <div className="flex gap-2">
            <div className="flex-1">
              <Campo rotulo="Mínimo">
                <select className={CLASSE_CAMPO} disabled={somenteLeitura} value={ligacao.min} onChange={(evento) => { mudar({ min: Number(evento.target.value) as 0 | 1 }) }}>
                  <option value={0}>0</option>
                  <option value={1}>1</option>
                </select>
              </Campo>
            </div>
            <div className="flex-1">
              <Campo rotulo="Máximo">
                <select className={CLASSE_CAMPO} disabled={somenteLeitura} value={ligacao.max} onChange={(evento) => { mudar({ max: evento.target.value as '1' | 'n' }) }}>
                  <option value="1">1</option>
                  <option value="n">N</option>
                </select>
              </Campo>
            </div>
          </div>
          <p className="text-xs text-neutral-600">
            Cada <strong>{nomeEntidade}</strong> participa de <strong>({ligacao.min},{ligacao.max})</strong> ocorrências de{' '}
            <strong>{nomeRelacionamento}</strong>.
          </p>
          <Campo rotulo="Papel (opcional — distingue auto-relacionamento ou n-ário)">
            <input
              className={CLASSE_CAMPO}
              value={ligacao.papel}
              disabled={somenteLeitura}
              placeholder="ex.: supervisor, subordinado"
              onChange={(evento) => { mudar({ papel: evento.target.value }, `participacao-papel:${ligacao.id}`) }}
              onBlur={onEncerrarGesto}
            />
          </Campo>
          {somenteLeitura ? null : (
            <button type="button" className={CLASSE_BOTAO_PERIGO} onClick={() => { onAplicar((c) => removerLigacao(c, ligacao.id)); onSelecionar(null) }}>
              Excluir participação
            </button>
          )}
        </div>
      )
    }

    if (selecao.tipo === 'filho') {
      const ligacao = conceitual.ligacoes.find((existente) => existente.id === selecao.id)
      if (ligacao?.tipo !== 'filho_especializacao') return <Orientacao />
      const filha = conceitual.elementos.find((elemento) => elemento.id === ligacao.entidadeId)
      return (
        <div className="flex flex-col gap-3">
          <Titulo>Entidade especializada</Titulo>
          <p className="text-xs text-neutral-800">
            <strong>{nomeDoElemento(filha) || 'entidade'}</strong> é um tipo da entidade genérica.
          </p>
          {somenteLeitura ? null : (
            <button
              type="button"
              className={CLASSE_BOTAO_PERIGO}
              onClick={() => { onAplicar((c) => removerLigacao(c, ligacao.id)); onSelecionar(null) }}
            >
              Desligar da especialização
            </button>
          )}
        </div>
      )
    }

    if (selecao.tipo === 'especializacao') {
      const especializacao = conceitual.elementos.find((elemento) => elemento.id === selecao.id)
      if (especializacao?.tipo !== 'especializacao') return <Orientacao />
      const generica = conceitual.elementos.find((elemento) => elemento.id === especializacao.paiId)
      const filhas = filhosDaEspecializacao(conceitual, especializacao.id)
      const mudar = (mudancas: Parameters<typeof atualizarEspecializacao>[2]): void => {
        onAplicar((c) => atualizarEspecializacao(c, especializacao.id, mudancas))
      }
      return (
        <div className="flex flex-col gap-3">
          {generica ? (
            <button type="button" className={`${CLASSE_BOTAO_TEXTO} self-start`} onClick={() => { onSelecionar({ tipo: 'entidade', id: generica.id }) }}>
              ← {nomeDoElemento(generica) || 'entidade'}
            </button>
          ) : null}
          <Titulo>Especialização</Titulo>
          <fieldset className="flex flex-col gap-1.5" disabled={somenteLeitura}>
            <legend className="sr-only">Tipo de especialização</legend>
            <Caixa
              rotulo="Total"
              dica="Toda ocorrência da genérica é de algum dos tipos especializados (senão é parcial)."
              marcado={especializacao.total}
              onChange={(marcado) => { mudar({ total: marcado }) }}
            />
            <Caixa
              rotulo="Disjunta"
              dica="Cada ocorrência é de um tipo só (senão é sobreposta)."
              marcado={especializacao.disjunta}
              onChange={(marcado) => { mudar({ disjunta: marcado }) }}
            />
          </fieldset>
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-neutral-700">Entidades especializadas</p>
            {filhas.length === 0 ? (
              <p className="text-xs italic text-neutral-500">arraste da alça até cada entidade especializada</p>
            ) : (
              <ul className="flex flex-col divide-y divide-neutral-100 rounded-md border border-neutral-200">
                {filhas.map((ligacao) => (
                  <li key={ligacao.id}>
                    <button
                      type="button"
                      className="block w-full truncate px-2 py-1 text-left text-sm text-neutral-900 hover:text-primary-700"
                      onClick={() => { onSelecionar({ tipo: 'filho', id: ligacao.id }) }}
                    >
                      {nomeDoElemento(conceitual.elementos.find((e) => e.id === ligacao.entidadeId)) || 'entidade'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {somenteLeitura ? null : (
            <button type="button" className={CLASSE_BOTAO_PERIGO} onClick={() => { onAplicar((c) => removerElemento(c, especializacao.id)); onSelecionar(null) }}>
              Excluir especialização
            </button>
          )}
        </div>
      )
    }

    if (selecao.tipo === 'atributo') {
      const atributo = conceitual.elementos.find((elemento) => elemento.id === selecao.id)
      if (atributo?.tipo !== 'atributo') return <Orientacao />
      const pai = conceitual.elementos.find((elemento) => elemento.id === atributo.paiId)
      const mudar = (mudancas: Parameters<typeof atualizarAtributo>[2], chave?: string): void => {
        onAplicar((c) => atualizarAtributo(c, atributo.id, mudancas), chave)
      }
      const temTamanho = atributo.tipoSugerido ? TIPOS_COM_TAMANHO.includes(atributo.tipoSugerido.tipo) : false
      const numero = (valor: string): number | null => {
        const n = Number.parseInt(valor, 10)
        return Number.isNaN(n) ? null : n
      }
      return (
        <div className="flex flex-col gap-3">
          {pai && (pai.tipo === 'entidade' || pai.tipo === 'relacionamento') ? (
            <button type="button" className={`${CLASSE_BOTAO_TEXTO} self-start`} onClick={() => { onSelecionar({ tipo: pai.tipo, id: pai.id }) }}>
              ← {pai.nome || pai.tipo}
            </button>
          ) : null}
          <Titulo>Atributo</Titulo>
          <Campo rotulo="Nome">
            <input
              className={CLASSE_CAMPO}
              value={atributo.nome}
              disabled={somenteLeitura}
              onChange={(evento) => { mudar({ nome: evento.target.value }, `atributo-nome:${atributo.id}`) }}
              onBlur={onEncerrarGesto}
            />
          </Campo>
          <fieldset className="flex flex-col gap-1.5" disabled={somenteLeitura}>
            <legend className="sr-only">Identificador</legend>
            <Caixa rotulo="Identificador (chave)" dica="Sublinhado na notação de Chen" marcado={atributo.chave} onChange={(marcado) => { mudar({ chave: marcado }) }} />
          </fieldset>
          <Campo rotulo="Cardinalidade do atributo">
            <select
              className={CLASSE_CAMPO}
              disabled={somenteLeitura}
              value={atributo.cardinalidade}
              onChange={(evento) => { mudar({ cardinalidade: evento.target.value as CardinalidadeAtributo }) }}
            >
              {CARDINALIDADES_ATRIBUTO.map((cardinalidade) => (
                <option key={cardinalidade} value={cardinalidade}>{cardinalidade}</option>
              ))}
            </select>
          </Campo>
          <ListaAtributos
            atributos={atributosDe(conceitual, atributo.id)}
            somenteLeitura={somenteLeitura}
            rotulo="Subatributos (atributo composto)"
            onSelecionar={(id) => { onSelecionar({ tipo: 'atributo', id }) }}
            onAdicionar={() => { onAdicionarAtributo(atributo.id) }}
          />
          <div className="flex flex-col gap-1.5 rounded-md border border-neutral-200 p-2">
            <p className="text-xs font-medium text-neutral-700">Sugestão de tipo (ajuda a conversão para o modelo lógico)</p>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <select
                  aria-label="Tipo sugerido"
                  className={CLASSE_CAMPO}
                  disabled={somenteLeitura}
                  value={atributo.tipoSugerido?.tipo ?? ''}
                  onChange={(evento) => {
                    const tipo = evento.target.value
                    mudar({ tipoSugerido: tipo === '' ? null : { tipo: tipo as TipoColuna, tamanho: null, escala: null } })
                  }}
                >
                  <option value="">(sem sugestão)</option>
                  {TIPOS_COLUNA.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                </select>
              </div>
              {atributo.tipoSugerido && temTamanho ? (
                <div className="w-16">
                  <input
                    aria-label="Tamanho sugerido"
                    type="number"
                    min={1}
                    className={CLASSE_CAMPO}
                    value={atributo.tipoSugerido.tamanho ?? ''}
                    disabled={somenteLeitura}
                    onChange={(evento) => {
                      if (!atributo.tipoSugerido) return
                      mudar({ tipoSugerido: { ...atributo.tipoSugerido, tamanho: numero(evento.target.value) } }, `atributo-tamanho:${atributo.id}`)
                    }}
                    onBlur={onEncerrarGesto}
                  />
                </div>
              ) : null}
            </div>
          </div>
          {somenteLeitura ? null : (
            <button
              type="button"
              className={`${CLASSE_BOTAO_PERIGO} self-start`}
              onClick={() => {
                onAplicar((c) => removerElemento(c, atributo.id))
                onSelecionar(pai && (pai.tipo === 'entidade' || pai.tipo === 'relacionamento') ? { tipo: pai.tipo, id: pai.id } : null)
              }}
            >
              Excluir atributo
            </button>
          )}
        </div>
      )
    }

    const elemento = conceitual.elementos.find((existente) => existente.id === selecao.id)
    if (!elemento || (elemento.tipo !== 'entidade' && elemento.tipo !== 'relacionamento')) return <Orientacao />
    const atributos = atributosDe(conceitual, elemento.id)

    if (elemento.tipo === 'relacionamento') {
      const participacoes = participacoesDe(conceitual, elemento.id)
      return (
        <div className="flex flex-col gap-3">
          <Titulo>Relacionamento</Titulo>
          <Campo rotulo="Nome">
            <input
              className={CLASSE_CAMPO}
              value={elemento.nome}
              disabled={somenteLeitura}
              onChange={(evento) => { onAplicar((c) => renomearElemento(c, elemento.id, evento.target.value), `nome:${elemento.id}`) }}
              onBlur={onEncerrarGesto}
            />
          </Campo>
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-neutral-700">Participantes</p>
            {participacoes.length === 0 ? (
              <p className="text-xs italic text-neutral-500">nenhuma entidade ligada ainda</p>
            ) : (
              <ul className="flex flex-col divide-y divide-neutral-100 rounded-md border border-neutral-200">
                {participacoes.map((participacao) => {
                  const entidade = conceitual.elementos.find((existente) => existente.id === participacao.entidadeId)
                  return (
                    <li key={participacao.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-1 px-2 py-1 text-left text-sm text-neutral-900 hover:text-primary-700"
                        onClick={() => { onSelecionar({ tipo: 'participacao', id: participacao.id }) }}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {nomeDoElemento(entidade) || 'entidade'}
                          {participacao.papel ? ` (${participacao.papel})` : ''}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-neutral-600">({participacao.min},{participacao.max})</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <ListaAtributos
            atributos={atributos}
            somenteLeitura={somenteLeitura}
            onSelecionar={(id) => { onSelecionar({ tipo: 'atributo', id }) }}
            onAdicionar={() => { onAdicionarAtributo(elemento.id) }}
          />
          <fieldset className="flex flex-col gap-1" disabled={somenteLeitura}>
            <legend className="sr-only">Entidade associativa</legend>
            <Caixa
              rotulo="Entidade associativa"
              dica="O relacionamento também vira entidade e pode participar de outros relacionamentos."
              marcado={elemento.associativa}
              onChange={(marcado) => {
                const resultado = definirAssociativa(conceitual, elemento.id, marcado)
                if (!resultado.ok) {
                  setErro(resultado.erro)
                  return
                }
                setErro(null)
                onAplicar(() => resultado.conceitual)
              }}
            />
            {erro ? <p role="alert" className="text-xs text-danger-600">{erro}</p> : null}
          </fieldset>
          {somenteLeitura ? null : (
            <button type="button" className={`${CLASSE_BOTAO_PERIGO} self-start`} onClick={() => { onAplicar((c) => removerElemento(c, elemento.id)); onSelecionar(null) }}>
              Excluir relacionamento
            </button>
          )}
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-3">
        <Titulo>Entidade</Titulo>
        <Campo rotulo="Nome">
          <input
            className={CLASSE_CAMPO}
            value={elemento.nome}
            disabled={somenteLeitura}
            onChange={(evento) => { onAplicar((c) => renomearElemento(c, elemento.id, evento.target.value), `nome:${elemento.id}`) }}
            onBlur={onEncerrarGesto}
          />
        </Campo>
        <ListaAtributos
          atributos={atributos}
          somenteLeitura={somenteLeitura}
          onSelecionar={(id) => { onSelecionar({ tipo: 'atributo', id }) }}
          onAdicionar={() => { onAdicionarAtributo(elemento.id) }}
        />
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-neutral-700">Especializações</p>
          {especializacoesDe(conceitual, elemento.id).length === 0 ? (
            <p className="text-xs italic text-neutral-500">nenhuma</p>
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-100 rounded-md border border-neutral-200">
              {especializacoesDe(conceitual, elemento.id).map((especializacao) => (
                <li key={especializacao.id}>
                  <button
                    type="button"
                    className="block w-full px-2 py-1 text-left text-sm text-neutral-900 hover:text-primary-700"
                    onClick={() => { onSelecionar({ tipo: 'especializacao', id: especializacao.id }) }}
                  >
                    {especializacao.total ? 'total' : 'parcial'}, {especializacao.disjunta ? 'disjunta' : 'sobreposta'} (
                    {String(filhosDaEspecializacao(conceitual, especializacao.id).length)})
                  </button>
                </li>
              ))}
            </ul>
          )}
          {somenteLeitura ? null : (
            <button type="button" className={`${CLASSE_BOTAO_TEXTO} self-start`} onClick={() => { onAdicionarEspecializacao(elemento.id) }}>
              + especialização
            </button>
          )}
        </div>
        {somenteLeitura ? null : (
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <button
              type="button"
              className={CLASSE_BOTAO_TEXTO}
              onClick={() => {
                const resultado = duplicarEntidade(conceitual, elemento.id)
                if (!resultado) return
                onAplicar(() => resultado.conceitual)
                onSelecionar({ tipo: 'entidade', id: resultado.id })
              }}
            >
              Duplicar
            </button>
            <button type="button" className={CLASSE_BOTAO_PERIGO} onClick={() => { onAplicar((c) => removerElemento(c, elemento.id)); onSelecionar(null) }}>
              Excluir entidade
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <aside aria-label="Propriedades" className="w-72 max-w-[75vw] shrink-0 overflow-y-auto border-l border-neutral-200 p-3">
      {conteudo()}
    </aside>
  )
}

export default PainelPropriedadesConceitual
