import type { ReactNode } from 'react'
import { SessaoForm } from '../components/SessaoForm'

export const SessaoPesquisaPage = (): ReactNode => {
  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold text-neutral-900">Pesquisa do TCC</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Tarefa da pesquisa: siga as orientações do pesquisador em cada etapa.
      </p>
      <div className="mt-6">
        <SessaoForm />
      </div>
    </div>
  )
}

export default SessaoPesquisaPage
