import { memo } from 'react'
import type { ReactNode } from 'react'
import type { Node, NodeProps } from '@xyflow/react'

export type NotaNodeTipo = Node<
  { texto: string; somenteLeitura: boolean; onTexto: (texto: string) => void; onEncerrar: () => void },
  'nota'
>

/** Anotação livre no canvas (serve aos dois modelos). */
const NotaNodeView = ({ data, selected }: NodeProps<NotaNodeTipo>): ReactNode => (
  <div
    className={`w-48 rounded-sm border bg-amber-50 p-1 shadow-sm ${selected ? 'border-amber-600 ring-2 ring-amber-200' : 'border-amber-300'}`}
  >
    <textarea
      aria-label="Texto da nota"
      placeholder="Anotação…"
      readOnly={data.somenteLeitura}
      className="nodrag nowheel h-20 w-full resize-none bg-transparent text-xs text-neutral-800 outline-none"
      value={data.texto}
      onChange={(evento) => { data.onTexto(evento.target.value) }}
      onBlur={data.onEncerrar}
    />
  </div>
)

export const NotaNode = memo(NotaNodeView)
