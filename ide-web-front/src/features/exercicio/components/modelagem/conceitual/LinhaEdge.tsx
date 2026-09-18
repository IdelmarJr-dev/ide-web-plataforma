import { memo } from 'react'
import type { ReactNode } from 'react'
import { BaseEdge, getBezierPath, useInternalNode } from '@xyflow/react'
import type { Edge, EdgeProps, InternalNode } from '@xyflow/react'
import { estiloLinha } from '../../../modelagem/estilos'
import { pontasDaLigacao } from '../../../modelagem/geometria'
import type { Retangulo } from '../../../modelagem/geometria'

/** Traço simples entre duas formas: atributo → pai, especialização → genérica/filhas. */
export type LinhaEdgeTipo = Edge<Record<string, never>, 'linha'>

function retangulo(node: InternalNode): Retangulo {
  return { x: node.internals.positionAbsolute.x, y: node.internals.positionAbsolute.y, largura: node.measured.width ?? 0, altura: node.measured.height ?? 0 }
}

const LinhaEdgeView = ({ id, source, target, selected }: EdgeProps<LinhaEdgeTipo>): ReactNode => {
  const origem = useInternalNode(source)
  const destino = useInternalNode(target)
  if (!origem || !destino) return null

  const [pontaOrigem, pontaDestino] = pontasDaLigacao(retangulo(origem), retangulo(destino))
  const [caminho] = getBezierPath({
    sourceX: pontaOrigem.x,
    sourceY: pontaOrigem.y,
    sourcePosition: pontaOrigem.lado,
    targetX: pontaDestino.x,
    targetY: pontaDestino.y,
    targetPosition: pontaDestino.lado,
  })

  return (
    <BaseEdge
      id={id}
      path={caminho}
      style={estiloLinha(selected ?? false, true)}
    />
  )
}

export const LinhaEdge = memo(LinhaEdgeView)
