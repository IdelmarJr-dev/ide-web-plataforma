import type { ReactNode } from 'react'
import { useReactFlow } from '@xyflow/react'

interface BotaoIconeProps {
  rotulo: string
  atalho?: string
  onClick: () => void
  disabled?: boolean
  ativo?: boolean
  children: ReactNode
}

export const BotaoIcone = ({ rotulo, atalho, onClick, disabled = false, ativo, children }: BotaoIconeProps): ReactNode => (
  <button
    type="button"
    aria-label={rotulo}
    title={atalho ? `${rotulo} (${atalho})` : rotulo}
    aria-pressed={ativo}
    disabled={disabled}
    onClick={onClick}
    className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm text-neutral-800 transition-colors
      hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2
      focus-visible:outline-primary-500 ${ativo ? 'bg-neutral-100 text-primary-700' : ''}`}
  >
    {children}
  </button>
)

const Separador = (): ReactNode => <span aria-hidden="true" className="mx-1 h-5 w-px bg-neutral-300" />

interface BarraFerramentasProps {
  podeDesfazer: boolean
  podeRefazer: boolean
  onDesfazer: () => void
  onRefazer: () => void
  podeDuplicar: boolean
  podeExcluir: boolean
  onDuplicar: () => void
  onExcluir: () => void
  grade: boolean
  onAlternarGrade: () => void
  somenteLeitura: boolean
  // Controles específicos do modelo (ex.: visão dos atributos) e itens à direita (salvamento, dica).
  extras?: ReactNode
  direita?: ReactNode
}

/** Barra superior comum aos editores de modelagem. Precisa estar dentro de um ReactFlowProvider. */
export const BarraFerramentas = ({
  podeDesfazer,
  podeRefazer,
  onDesfazer,
  onRefazer,
  podeDuplicar,
  podeExcluir,
  onDuplicar,
  onExcluir,
  grade,
  onAlternarGrade,
  somenteLeitura,
  extras,
  direita,
}: BarraFerramentasProps): ReactNode => {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  return (
    <div role="toolbar" aria-label="Ferramentas do modelo" className="flex flex-wrap items-center gap-0.5 border-b border-neutral-200 px-1 py-1">
      {somenteLeitura ? null : (
        <>
          <BotaoIcone rotulo="Desfazer" atalho="Ctrl+Z" onClick={onDesfazer} disabled={!podeDesfazer}>↶</BotaoIcone>
          <BotaoIcone rotulo="Refazer" atalho="Ctrl+Y" onClick={onRefazer} disabled={!podeRefazer}>↷</BotaoIcone>
          <Separador />
        </>
      )}
      <BotaoIcone rotulo="Diminuir zoom" onClick={() => { void zoomOut() }}>−</BotaoIcone>
      <BotaoIcone rotulo="Aumentar zoom" onClick={() => { void zoomIn() }}>+</BotaoIcone>
      <BotaoIcone rotulo="Ajustar à tela" onClick={() => { void fitView({ padding: 0.2 }) }}>⤢</BotaoIcone>
      {somenteLeitura ? null : (
        <>
          <Separador />
          <BotaoIcone rotulo="Duplicar selecionado" atalho="Ctrl+D" onClick={onDuplicar} disabled={!podeDuplicar}>⧉</BotaoIcone>
          <BotaoIcone rotulo="Excluir selecionado" atalho="Delete" onClick={onExcluir} disabled={!podeExcluir}>🗑</BotaoIcone>
        </>
      )}
      <Separador />
      <BotaoIcone rotulo="Grade" onClick={onAlternarGrade} ativo={grade}>#</BotaoIcone>
      {extras}
      {direita ? <div className="ml-auto flex items-center gap-2 pl-2">{direita}</div> : null}
    </div>
  )
}

export default BarraFerramentas
