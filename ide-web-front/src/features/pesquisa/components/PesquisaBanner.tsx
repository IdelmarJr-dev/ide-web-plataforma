import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMinhaParticipacao } from '../hooks/useMinhaParticipacao'

const LINK_CLASSES = `mt-3 inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm
  font-medium text-white transition-colors hover:bg-primary-700`

export const PesquisaBanner = (): ReactNode => {
  const { data: participacao } = useMinhaParticipacao()

  if (!participacao?.pesquisa || participacao.tcle === 'recusado' || participacao.rtlxRespondido) {
    return null
  }

  if (participacao.tcle === 'pendente') {
    return (
      <div className="rounded-md border border-primary-500 bg-primary-50 p-4">
        <p className="text-sm font-medium text-neutral-900">A pesquisa do TCC começou.</p>
        <p className="mt-1 text-sm text-neutral-600">
          Leia o termo de consentimento e decida se quer participar — é opcional.
        </p>
        <Link to="/tcle" className={LINK_CLASSES}>
          Ver o termo de consentimento
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-primary-500 bg-primary-50 p-4">
      <p className="text-sm font-medium text-neutral-900">Você está participando da pesquisa.</p>
      <Link to="/pesquisa/sessao" className={LINK_CLASSES}>
        Continuar participação
      </Link>
    </div>
  )
}

export default PesquisaBanner
