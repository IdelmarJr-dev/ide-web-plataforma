import { memo, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { Tabela } from '../../../modelagem/documento'
import { renderizarTipo } from '../../../modelagem/gerarSql'
import { normalizarIdentificador } from '../../../modelagem/identificadores'
import { classeAlca, CLASSE_CAIXA, classeContorno } from '../../../modelagem/estilos'
import { useLogicoEditor } from '../../../modelagem/logico/editorContexto'

export type TabelaNodeTipo = Node<{ tabela: Tabela }, 'tabela'>

// Alças nas laterais: arrastar de uma tabela e soltar em qualquer ponto de outra cria
// a ligação (o drop no corpo da tabela é tratado em LogicoEditor).
const Selo = ({ children, titulo }: { children: ReactNode; titulo: string }): ReactNode => (
  <abbr title={titulo} className="rounded bg-neutral-100 px-1 text-[10px] font-semibold text-neutral-600 no-underline">
    {children}
  </abbr>
)

const TabelaNodeView = ({ data, selected }: NodeProps<TabelaNodeTipo>): ReactNode => {
  const { tabela } = data
  const { selecao, selecionar, renomearTabela, encerrarGesto, somenteLeitura, destaque } = useLogicoEditor()
  const [editandoNome, setEditandoNome] = useState(false)
  const campoNomeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editandoNome) campoNomeRef.current?.select()
  }, [editandoNome])

  const nomeNormalizado = normalizarIdentificador(tabela.nome)
  const destacada = destaque !== null && destaque.tabela === nomeNormalizado
  const colunaSelecionada = selecao?.tipo === 'coluna' && selecao.tabelaId === tabela.id ? selecao.colunaId : null

  const terminarEdicao = (): void => {
    setEditandoNome(false)
    encerrarGesto()
  }

  return (
    <div
      data-testid="tabela-node"
      data-destacada={destacada || undefined}
      className={`min-w-52 ${CLASSE_CAIXA} ${classeContorno(selected, destacada)}`}
    >
      <Handle type="source" position={Position.Left} id="esquerda" className={classeAlca(somenteLeitura)} isConnectable={!somenteLeitura} />
      <Handle type="source" position={Position.Right} id="direita" className={classeAlca(somenteLeitura)} isConnectable={!somenteLeitura} />

      <div
        className={`rounded-t-sm border-b border-neutral-300 px-2 py-1.5 ${destacada ? 'bg-primary-100' : 'bg-neutral-100'}`}
        onDoubleClick={() => { if (!somenteLeitura) setEditandoNome(true) }}
      >
        {editandoNome ? (
          <input
            ref={campoNomeRef}
            aria-label="Nome da tabela"
            className="nodrag w-full rounded border border-primary-500 px-1 text-sm font-semibold outline-none"
            value={tabela.nome}
            onChange={(evento) => { renomearTabela(tabela.id, evento.target.value) }}
            onBlur={terminarEdicao}
            onKeyDown={(evento: KeyboardEvent<HTMLInputElement>) => {
              if (evento.key === 'Enter' || evento.key === 'Escape') terminarEdicao()
            }}
          />
        ) : (
          <p className="truncate text-sm font-semibold text-neutral-900" title="Duplo clique para renomear">
            {nomeNormalizado || 'tabela sem nome'}
          </p>
        )}
      </div>

      <ul className="py-1">
        {tabela.colunas.length === 0 ? <li className="px-2 py-0.5 italic text-neutral-500">sem colunas</li> : null}
        {tabela.colunas.map((coluna) => {
          const nomeColuna = normalizarIdentificador(coluna.nome)
          const colunaDestacada = destacada && destaque.coluna === nomeColuna
          const ativa = colunaSelecionada === coluna.id
          return (
            <li key={coluna.id}>
              <button
                type="button"
                data-destacada={colunaDestacada || undefined}
                aria-label={`Coluna ${nomeColuna || 'sem nome'} de ${nomeNormalizado || 'tabela sem nome'}`}
                aria-pressed={ativa}
                className={`flex w-full items-center gap-1.5 px-2 py-0.5 text-left hover:bg-neutral-50 ${
                  ativa ? 'bg-primary-50' : ''
                } ${colunaDestacada ? 'bg-primary-100' : ''}`}
                onClick={(evento) => {
                  evento.stopPropagation()
                  selecionar({ tipo: 'coluna', tabelaId: tabela.id, colunaId: coluna.id })
                }}
              >
                <span className="w-7 shrink-0 font-mono text-[10px] font-bold">
                  {coluna.pk ? <span className="text-primary-700">PK</span> : null}
                  {coluna.pk && coluna.fk ? ' ' : null}
                  {coluna.fk ? <span className="text-neutral-600">FK</span> : null}
                </span>
                <span className={`min-w-0 flex-1 truncate ${coluna.pk ? 'font-semibold underline' : ''}`}>
                  {nomeColuna || 'coluna sem nome'}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-neutral-600">{renderizarTipo(coluna)}</span>
                {coluna.notNull && !coluna.pk ? <Selo titulo="NOT NULL">NN</Selo> : null}
                {coluna.unique ? <Selo titulo="UNIQUE">UQ</Selo> : null}
                {coluna.autoIncremento ? <Selo titulo="Autoincremento">AI</Selo> : null}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export const TabelaNode = memo(TabelaNodeView)
