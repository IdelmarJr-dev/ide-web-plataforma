import { memo, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { VisaoAtributos } from '../../../modelagem/documento'
import type { AtributoElemento, EntidadeElemento } from '../../../modelagem/conceitual/operacoes'
import { classeAlca, CLASSE_CAIXA, classeContorno } from '../../../modelagem/estilos'
import { useConceitualEditor } from '../../../modelagem/conceitual/editorContexto'

export type EntidadeNodeTipo = Node<{ entidade: EntidadeElemento; atributos: { atributo: AtributoElemento; nivel: number }[]; visaoAtributos: VisaoAtributos }, 'entidade'>

const EntidadeNodeView = ({ data, selected }: NodeProps<EntidadeNodeTipo>): ReactNode => {
  const { entidade, atributos, visaoAtributos } = data
  const { selecao, selecionar, renomearElemento, encerrarGesto, somenteLeitura } = useConceitualEditor()
  const [editandoNome, setEditandoNome] = useState(false)
  const campoNomeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editandoNome) campoNomeRef.current?.select()
  }, [editandoNome])

  const terminarEdicao = (): void => {
    setEditandoNome(false)
    encerrarGesto()
  }

  return (
    <div
      data-testid="entidade-node"
      className={`min-w-36 ${CLASSE_CAIXA} ${classeContorno(selected)}`}
    >
      <Handle type="source" position={Position.Top} id="cima" className={classeAlca(somenteLeitura)} isConnectable={!somenteLeitura} />
      <Handle type="source" position={Position.Right} id="direita" className={classeAlca(somenteLeitura)} isConnectable={!somenteLeitura} />
      <Handle type="source" position={Position.Bottom} id="baixo" className={classeAlca(somenteLeitura)} isConnectable={!somenteLeitura} />
      <Handle type="source" position={Position.Left} id="esquerda" className={classeAlca(somenteLeitura)} isConnectable={!somenteLeitura} />

      <div
        className="px-3 py-2 text-center"
        onDoubleClick={() => {
          if (!somenteLeitura) setEditandoNome(true)
        }}
      >
        {editandoNome ? (
          <input
            ref={campoNomeRef}
            aria-label="Nome da entidade"
            className="nodrag w-full rounded border border-primary-500 px-1 text-center text-sm font-semibold outline-none"
            value={entidade.nome}
            onChange={(evento) => { renomearElemento(entidade.id, evento.target.value) }}
            onBlur={terminarEdicao}
            onKeyDown={(evento: KeyboardEvent<HTMLInputElement>) => {
              if (evento.key === 'Enter' || evento.key === 'Escape') terminarEdicao()
            }}
          />
        ) : (
          <p className="truncate text-sm font-semibold text-neutral-900" title="Duplo clique para renomear">
            {entidade.nome || 'entidade sem nome'}
          </p>
        )}
      </div>

      {visaoAtributos === 'lista' && atributos.length > 0 ? (
        <ul className="border-t border-neutral-300 py-1">
          {atributos.map(({ atributo, nivel }) => {
            const ativo = selecao?.tipo === 'atributo' && selecao.id === atributo.id
            return (
              <li key={atributo.id} style={nivel > 0 ? { paddingLeft: nivel * 10 } : undefined}>
                <button
                  type="button"
                  aria-label={`Atributo ${atributo.nome || 'sem nome'} de ${entidade.nome || 'entidade sem nome'}`}
                  aria-pressed={ativo}
                  className={`block w-full px-2 py-0.5 text-left hover:bg-neutral-50 ${ativo ? 'bg-primary-50' : ''}`}
                  onClick={(evento) => {
                    evento.stopPropagation()
                    selecionar({ tipo: 'atributo', id: atributo.id })
                  }}
                >
                  <span className={atributo.chave ? 'font-semibold underline' : ''}>{atributo.nome || 'atributo sem nome'}</span>
                  {/* Multivalorado: na visão em círculos é o contorno duplo; aqui, a cardinalidade. */}
                  {atributo.cardinalidade === '(0,n)' || atributo.cardinalidade === '(1,n)' ? (
                    <span className="ml-1 font-mono text-[10px] text-neutral-600">{atributo.cardinalidade}</span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

export const EntidadeNode = memo(EntidadeNodeView)
