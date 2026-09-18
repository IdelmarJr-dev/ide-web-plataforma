import type { ReactNode } from 'react'
import { SusForm } from '../components/SusForm'

export const SusPage = (): ReactNode => {
  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="text-xl font-semibold text-neutral-900">Questionário SUS</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Escala de Usabilidade de Sistema — como foi usar o ambiente das tarefas.
      </p>
      <div className="mt-6">
        <SusForm />
      </div>
    </div>
  )
}

export default SusPage
