import type { ReactNode } from 'react'
import type { StatusSalvamento } from '../../modelagem/useAutosaveModelagem'

const formatarHora = (data: Date): string =>
  data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export const IndicadorSalvamento = ({ status }: { status: StatusSalvamento }): ReactNode => {
  switch (status.estado) {
    case 'salvo':
      return (
        <span className="text-xs text-neutral-600" aria-live="polite">
          {status.em ? `Salvo às ${formatarHora(status.em)}` : 'Tudo salvo'}
        </span>
      )
    case 'pendente':
      return <span className="text-xs text-neutral-600" aria-live="polite">Alterações não salvas…</span>
    case 'salvando':
      return <span className="text-xs text-neutral-600" aria-live="polite">Salvando…</span>
    case 'erro':
      return (
        <span role="alert" className="text-xs text-danger-600">
          Não salvo — tentando de novo
        </span>
      )
    case 'invalido':
      return (
        <span role="alert" className="text-xs text-danger-600" title={status.mensagem}>
          Não salvo: {status.mensagem}
        </span>
      )
  }
}

export default IndicadorSalvamento
