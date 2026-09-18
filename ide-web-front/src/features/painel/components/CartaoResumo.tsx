import type { ReactNode } from 'react'

interface CartaoResumoProps {
  rotulo: string
  valor: number
  destaque?: boolean
}

export const CartaoResumo = ({ rotulo, valor, destaque = false }: CartaoResumoProps): ReactNode => (
  <div
    className={`rounded-lg border p-4 ${
      destaque && valor > 0 ? 'border-primary-500 bg-primary-50' : 'border-neutral-300 bg-white'
    }`}
  >
    <span className="block text-2xl font-semibold text-neutral-900">{valor}</span>
    <span className="mt-1 block text-xs text-neutral-600">{rotulo}</span>
  </div>
)
