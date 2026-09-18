import type { ReactNode } from 'react'
import { useTema } from './temaContext'

/** Botão fixo — não há shell de layout global, então ele se injeta uma vez em App.tsx em vez de
 * cada página precisar de um cabeçalho compartilhado. Fica no canto inferior direito: o superior
 * direito colide com o "Voltar"/"Finalizar" que várias páginas já colocam ali (sem shell, cada
 * página escolhe esse canto por conta própria). */
export const BotaoTema = (): ReactNode => {
  const { tema, alternarTema } = useTema()

  return (
    <button
      type="button"
      onClick={alternarTema}
      aria-label={tema === 'escuro' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}
      className="fixed bottom-3 right-3 z-40 flex h-9 w-9 items-center justify-center rounded-full border
        border-neutral-300 bg-surface text-sm shadow-sm transition-colors hover:bg-neutral-100
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
    >
      <span aria-hidden="true">{tema === 'escuro' ? '☀️' : '🌙'}</span>
    </button>
  )
}

export default BotaoTema
