import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { TemaContext } from './temaContext'
import type { Tema } from './temaContext'

// Mesma chave do script inline em index.html, que evita o flash de tema errado no primeiro paint.
const CHAVE_ARMAZENAMENTO = 'tema'

function temaInicial(): Tema {
  const salvo = localStorage.getItem(CHAVE_ARMAZENAMENTO)
  if (salvo === 'claro' || salvo === 'escuro') return salvo
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro'
}

export const TemaProvider = ({ children }: { children: ReactNode }): ReactNode => {
  const [tema, setTema] = useState<Tema>(temaInicial)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'escuro')
    localStorage.setItem(CHAVE_ARMAZENAMENTO, tema)
  }, [tema])

  const alternarTema = (): void => {
    setTema((atual) => (atual === 'escuro' ? 'claro' : 'escuro'))
  }

  return <TemaContext value={{ tema, alternarTema }}>{children}</TemaContext>
}

export default TemaProvider
