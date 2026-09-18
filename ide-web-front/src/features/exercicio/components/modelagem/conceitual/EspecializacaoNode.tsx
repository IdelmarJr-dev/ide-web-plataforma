import { memo } from 'react'
import type { ReactNode } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { EspecializacaoElemento } from '../../../modelagem/conceitual/operacoes'
import { classeAlca, CLASSE_ROTULO_LINHA, tracoDaForma } from '../../../modelagem/estilos'
import { useConceitualEditor } from '../../../modelagem/conceitual/editorContexto'

export type EspecializacaoNodeTipo = Node<{ especializacao: EspecializacaoElemento }, 'especializacao'>

/** Triângulo da especialização, com a marca (total|parcial, disjunta|sobreposta). */
const EspecializacaoNodeView = ({ data, selected }: NodeProps<EspecializacaoNodeTipo>): ReactNode => {
  const { especializacao } = data
  const { somenteLeitura } = useConceitualEditor()
  const marca = `${especializacao.total ? 't' : 'p'},${especializacao.disjunta ? 'd' : 's'}`
  const descricao = `${especializacao.total ? 'total' : 'parcial'}, ${especializacao.disjunta ? 'disjunta' : 'sobreposta'}`

  return (
    <div data-testid="especializacao-node" className="relative flex w-16 flex-col items-center" title={`Especialização ${descricao}`}>
      <Handle type="source" position={Position.Top} id="cima" className={classeAlca(somenteLeitura)} isConnectable={!somenteLeitura} />
      <Handle type="source" position={Position.Right} id="direita" className={classeAlca(somenteLeitura)} isConnectable={!somenteLeitura} />
      <Handle type="source" position={Position.Bottom} id="baixo" className={classeAlca(somenteLeitura)} isConnectable={!somenteLeitura} />
      <Handle type="source" position={Position.Left} id="esquerda" className={classeAlca(somenteLeitura)} isConnectable={!somenteLeitura} />

      <svg viewBox="0 0 56 40" width="56" height="40" aria-hidden="true">
        <polygon
          points="28,3 53,37 3,37"
          fill="white"
          {...tracoDaForma(selected)}
        />
      </svg>
      <span className={`${CLASSE_ROTULO_LINHA} relative -mt-3 px-1 font-mono`}>({marca})</span>
    </div>
  )
}

export const EspecializacaoNode = memo(EspecializacaoNodeView)
