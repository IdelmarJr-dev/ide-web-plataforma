import { memo, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { AtributoElemento } from '../../../modelagem/conceitual/operacoes'
import { classeContorno } from '../../../modelagem/estilos'
import { useConceitualEditor } from '../../../modelagem/conceitual/editorContexto'

export type AtributoNodeTipo = Node<{ atributo: AtributoElemento; composto: boolean }, 'atributo'>

/** Só usado na visão "círculos" (D5) — na visão "lista" o atributo aparece dentro do pai. */
const AtributoNodeView = ({ data, selected }: NodeProps<AtributoNodeTipo>): ReactNode => {
  const { atributo, composto } = data
  // Notação de Chen: multivalorado tem contorno duplo; composto pendura os filhos.
  const multivalorado = atributo.cardinalidade === '(0,n)' || atributo.cardinalidade === '(1,n)'
  const { renomearElemento, encerrarGesto, somenteLeitura } = useConceitualEditor()
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
      data-testid="atributo-node"
      data-multivalorado={multivalorado || undefined}
      title={multivalorado ? 'Atributo multivalorado' : composto ? 'Atributo composto' : undefined}
      className={`flex h-12 w-24 items-center justify-center rounded-full bg-white px-2 text-center text-[11px] shadow-sm
        ${classeContorno(selected)} ${multivalorado ? 'outline outline-2 outline-offset-2 outline-neutral-700' : ''}`}
      onDoubleClick={() => {
        if (!somenteLeitura) setEditandoNome(true)
      }}
    >
      {/* Invisíveis: só existem pra `LinhaEdge` ter pontas (React Flow reclama sem nenhuma);
          um atributo composto é origem da linha até os filhos. O traço é calculado à mão. */}
      <Handle type="target" position={Position.Top} isConnectable={false} className="pointer-events-none! opacity-0!" />
      <Handle type="source" id="filhos" position={Position.Bottom} isConnectable={false} className="pointer-events-none! opacity-0!" />
      {editandoNome ? (
        <input
          ref={campoNomeRef}
          aria-label="Nome do atributo"
          className="nodrag w-full rounded border border-primary-500 bg-white px-1 text-center text-[11px] outline-none"
          value={atributo.nome}
          onChange={(evento) => { renomearElemento(atributo.id, evento.target.value) }}
          onBlur={terminarEdicao}
          onKeyDown={(evento: KeyboardEvent<HTMLInputElement>) => {
            if (evento.key === 'Enter' || evento.key === 'Escape') terminarEdicao()
          }}
        />
      ) : (
        <span className={`truncate ${atributo.chave ? 'font-semibold underline' : ''}`} title="Duplo clique para renomear">
          {atributo.nome || 'atributo'}
        </span>
      )}
    </div>
  )
}

export const AtributoNode = memo(AtributoNodeView)
