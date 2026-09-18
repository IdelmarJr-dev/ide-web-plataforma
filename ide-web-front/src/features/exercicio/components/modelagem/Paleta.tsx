import type { DragEvent, ReactNode } from 'react'

export const TIPO_ARRASTO_PALETA = 'application/x-ide-web-modelagem'

export interface ItemPaleta<T extends string> {
  tipo: T
  rotulo: string
  icone: ReactNode
}

interface PaletaProps<T extends string> {
  itens: ItemPaleta<T>[]
  onAdicionar: (tipo: T) => void
}

/** Paleta lateral: clicar adiciona no centro da área visível; arrastar solta onde o aluno quiser. */
export const Paleta = <T extends string>({ itens, onAdicionar }: PaletaProps<T>): ReactNode => (
  <ul aria-label="Elementos" className="flex w-20 shrink-0 flex-col gap-1 border-r border-neutral-200 p-1">
    {itens.map((item) => (
      <li key={item.tipo}>
        <button
          type="button"
          draggable
          title={`Clique ou arraste para adicionar: ${item.rotulo}`}
          onDragStart={(evento: DragEvent<HTMLButtonElement>) => {
            evento.dataTransfer.setData(TIPO_ARRASTO_PALETA, item.tipo)
            evento.dataTransfer.effectAllowed = 'copy'
          }}
          onClick={() => { onAdicionar(item.tipo) }}
          className="flex w-full cursor-grab flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[11px] text-neutral-700
            hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
        >
          <span aria-hidden="true" className="flex h-6 items-center text-neutral-800">{item.icone}</span>
          {item.rotulo}
        </button>
      </li>
    ))}
  </ul>
)

export default Paleta
