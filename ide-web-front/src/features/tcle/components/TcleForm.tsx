import type { ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '~components/Button/Button'
import { MINHA_PARTICIPACAO_QUERY_KEY } from '~features/pesquisa/hooks/useMinhaParticipacao'
import { pesquisaService } from '~features/pesquisa/services/pesquisaService'
import { TermoTexto } from './TermoTexto'

export const TcleForm = (): ReactNode => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const consentirMutation = useMutation({
    mutationFn: (aceito: boolean) => pesquisaService.consentirTcle(aceito),
    onSuccess: async (status) => {
      await queryClient.invalidateQueries({ queryKey: MINHA_PARTICIPACAO_QUERY_KEY })
      if (status.consentido) {
        void navigate('/pesquisa/sessao')
      }
    },
  })

  if (consentirMutation.isSuccess && !consentirMutation.data.consentido) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-neutral-900">Tudo bem, obrigado por avisar.</p>
        <p className="text-sm text-neutral-600">
          Você não vai participar da pesquisa, mas pode continuar usando a IDE Web normalmente.
        </p>
        <Link to="/dashboard" className="mt-2 text-sm font-medium text-primary-600 hover:underline">
          Voltar ao painel
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <TermoTexto />

      {consentirMutation.isError ? (
        <p role="alert" className="text-sm text-danger-500">
          {consentirMutation.error.message}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button
          isLoading={consentirMutation.isPending && consentirMutation.variables}
          onClick={() => { consentirMutation.mutate(true) }}
        >
          Li e aceito participar
        </Button>
        <Button
          variant="ghost"
          isLoading={consentirMutation.isPending && !consentirMutation.variables}
          onClick={() => { consentirMutation.mutate(false) }}
        >
          Não quero participar
        </Button>
      </div>
    </div>
  )
}

export default TcleForm
