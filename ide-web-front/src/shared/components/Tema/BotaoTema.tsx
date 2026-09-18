import type { ReactNode } from 'react'
import { useTema } from './temaContext'

/** Botão fixo no canto superior direito — não há shell de layout global, então ele se injeta uma
 * vez em App.tsx em vez de cada página precisar de um cabeçalho compartilhado. Esse canto colide
 * com o "Voltar"/"Finalizar" que algumas páginas já colocam ali; ExercicioPage e EstudoLivrePage
 * reservam espaço pra ele (`pr-11` nos cabeçalhos) — outras páginas com conteúdo raro nesse canto
 * podem precisar do mesmo ajuste se aparecer sobreposição. */
export const BotaoTema = (): ReactNode => {
  const { tema, alternarTema } = useTema()

  return (
    <button
      type="button"
      onClick={alternarTema}
      aria-label={tema === 'escuro' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}
      className="fixed right-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-full border
        border-neutral-300 bg-surface text-sm shadow-sm transition-colors hover:bg-neutral-100
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
    >
      <span aria-hidden="true">{tema === 'escuro' ? '☀️' : '🌙'}</span>
    </button>
  )
}

export default BotaoTema
