import { memo, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { VisaoAtributos } from '../../../modelagem/documento'
import type { AtributoElemento, RelacionamentoElemento } from '../../../modelagem/conceitual/operacoes'
import { classeAlca, CLASSE_CAIXA, classeContorno, tracoDaForma } from '../../../modelagem/estilos'
import { useConceitualEditor } from '../../../modelagem/conceitual/editorContexto'

export type RelacionamentoNodeTipo = Node<
  { relacionamento: RelacionamentoElemento; atributos: { atributo: AtributoElemento; nivel: number }[]; visaoAtributos: VisaoAtributos },
  'relacionamento'
>

const RelacionamentoNodeView = ({ data, selected }: NodeProps<RelacionamentoNodeTipo>): ReactNode => {
  const { relacionamento, atributos, visaoAtributos } = data
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
    <div data-testid="relacionamento-node" className="flex flex-col items-center">
      {/* Losango em SVG: `clip-path` só recorta a caixa retangular original, não desenha uma
          borda nova ao longo da forma — sobra só um traço nos 4 vértices. Um polígono com
          `stroke` de verdade é a forma correta de desenhar o contorno do losango. */}
      <div
        className={`relative ${
          // Entidade associativa: losango dentro de um retângulo (notação de Chen).
          relacionamento.associativa
            ? `h-20 w-40 p-1.5 ${CLASSE_CAIXA} ${classeContorno(selected)}`
            : 'h-16 w-36'
        }`}
        data-associativa={relacionamento.associativa || undefined}
      >
        <Handle type="source" position={Position.Top} id="cima" className={classeAlca(somenteLeitura)} isConnectable={!somenteLeitura} />
        <Handle type="source" position={Position.Right} id="direita" className={classeAlca(somenteLeitura)} isConnectable={!somenteLeitura} />
        <Handle type="source" position={Position.Bottom} id="baixo" className={classeAlca(somenteLeitura)} isConnectable={!somenteLeitura} />
        <Handle type="source" position={Position.Left} id="esquerda" className={classeAlca(somenteLeitura)} isConnectable={!somenteLeitura} />

        <div className="relative h-full w-full">
          <svg viewBox="0 0 144 64" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            <polygon
              points="72,3 141,32 72,61 3,32"
              fill="white"
              {...tracoDaForma(selected)}
            />
          </svg>

          <div
            className="relative flex h-full w-full items-center justify-center px-7 text-center"
            onDoubleClick={() => {
              if (!somenteLeitura) setEditandoNome(true)
            }}
          >
            {editandoNome ? (
              <input
                ref={campoNomeRef}
                aria-label="Nome do relacionamento"
                className="nodrag w-24 rounded border border-primary-500 px-1 text-center text-xs font-semibold outline-none"
                value={relacionamento.nome}
                onChange={(evento) => { renomearElemento(relacionamento.id, evento.target.value) }}
                onBlur={terminarEdicao}
                onKeyDown={(evento: KeyboardEvent<HTMLInputElement>) => {
                  if (evento.key === 'Enter' || evento.key === 'Escape') terminarEdicao()
                }}
              />
            ) : (
              <p className="truncate text-xs font-semibold text-neutral-900" title="Duplo clique para renomear">
                {relacionamento.nome || 'relacionamento sem nome'}
              </p>
            )}
          </div>
        </div>
      </div>

      {visaoAtributos === 'lista' && atributos.length > 0 ? (
        <ul className="mt-1 min-w-28 rounded-sm border border-neutral-300 bg-surface py-1 text-xs shadow-sm">
          {atributos.map(({ atributo, nivel }) => {
            const ativo = selecao?.tipo === 'atributo' && selecao.id === atributo.id
            return (
              <li key={atributo.id} style={nivel > 0 ? { paddingLeft: nivel * 10 } : undefined}>
                <button
                  type="button"
                  aria-label={`Atributo ${atributo.nome || 'sem nome'} de ${relacionamento.nome || 'relacionamento sem nome'}`}
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

export const RelacionamentoNode = memo(RelacionamentoNodeView)
