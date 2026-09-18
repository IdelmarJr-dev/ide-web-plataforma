import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Expande o editor para a tela inteira sem mudar o padrão: o tamanho normal continua
 * sendo o de sempre, e a tela cheia é uma escolha do momento (Fase 10, item 14).
 */
export const TelaCheia = ({ children }: { children: ReactNode }): ReactNode => {
  const [cheia, setCheia] = useState(false)

  // Esc devolve ao tamanho normal — é o que o usuário espera de tela cheia.
  useEffect(() => {
    if (!cheia) return undefined

    const aoTeclar = (evento: KeyboardEvent): void => {
      if (evento.key === 'Escape') setCheia(false)
    }

    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [cheia])

  return (
    <div className={cheia ? 'fixed inset-0 z-50 flex flex-col gap-2 bg-white p-4' : 'flex h-full w-full flex-col'}>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setCheia((atual) => !atual)
          }}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
        >
          {cheia ? 'Sair da tela cheia (Esc)' : 'Expandir para tela cheia'}
        </button>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}
