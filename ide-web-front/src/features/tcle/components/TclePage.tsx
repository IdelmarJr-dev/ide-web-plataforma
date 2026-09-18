import type { ReactNode } from 'react'
import { TcleForm } from './TcleForm'

export const TclePage = (): ReactNode => (
  <div className="mx-auto max-w-lg p-6">
    <h1 className="text-xl font-semibold text-neutral-900">Termo de Consentimento Livre e Esclarecido</h1>
    <p className="mt-1 text-sm text-neutral-600">
      Leia com calma — participar é opcional e não afeta seu uso normal da ferramenta.
    </p>
    <div className="mt-6">
      <TcleForm />
    </div>
  </div>
)

export default TclePage
