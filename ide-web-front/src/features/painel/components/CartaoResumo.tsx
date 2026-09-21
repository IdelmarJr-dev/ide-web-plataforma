import type { ReactNode } from 'react'

interface CartaoResumoProps {
  rotulo: string
  valor: number
  destaque?: boolean
}

export const CartaoResumo = ({ rotulo, valor, destaque = false }: CartaoResumoProps): ReactNode => (
  <div
    className={`rounded-lg border p-4 ${
      destaque && valor > 0 ? 'border-primary-500 bg-primary-50' : 'border-neutral-300 bg-surface'
    }`}
  >
    <span
      className={`block font-mono text-[10.5px] font-semibold uppercase tracking-wide ${
        destaque && valor > 0 ? 'text-primary-700' : 'text-neutral-600'
      }`}
    >
      {rotulo}
    </span>
    <span
      className={`mt-1 block font-mono text-2xl font-bold ${
        destaque && valor > 0 ? 'text-primary-700' : 'text-neutral-900'
      }`}
    >
      {valor}
    </span>
  </div>
)
