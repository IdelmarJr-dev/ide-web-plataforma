import { useCallback, useState } from 'react'
import type { ChangeEvent, ReactNode, SyntheticEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '~components/Button/Button'
import { Input } from '~components/Input/Input'
import { TURMAS_QUERY_KEY } from '../hooks/queryKeys'
import { turmasService } from '../services/turmasService'
import { matricularSchema } from '../types'

/**
 * Matrícula por código. O aluno já chega logado, então o código é usado uma vez só e
 * ele permanece na turma até o professor encerrá-la — não precisa pedir o código ao
 * professor a cada aula (Fase 8).
 */
export const EntrarTurmaForm = (): ReactNode => {
  const [codigo, setCodigo] = useState('')
  const [erroCodigo, setErroCodigo] = useState<string | undefined>(undefined)
  const queryClient = useQueryClient()

  const matricularMutation = useMutation({
    mutationFn: (codigoTurma: string) => turmasService.matricular(codigoTurma),
    onSuccess: () => {
      setCodigo('')
      void queryClient.invalidateQueries({ queryKey: TURMAS_QUERY_KEY })
    },
  })

  const handleSubmit = useCallback(
    (event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault()

      const result = matricularSchema.safeParse({ codigo })
      if (!result.success) {
        setErroCodigo(result.error.issues[0]?.message)
        return
      }

      setErroCodigo(undefined)
      matricularMutation.mutate(result.data.codigo)
    },
    [codigo, matricularMutation],
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <Input
        label="Código da turma"
        name="codigo"
        value={codigo}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          setCodigo(event.target.value)
        }}
        {...(erroCodigo === undefined ? {} : { errorMessage: erroCodigo })}
      />

      {matricularMutation.isError ? (
        <p role="alert" className="text-sm text-danger-500">
          {matricularMutation.error.message}
        </p>
      ) : null}

      {matricularMutation.isSuccess ? (
        <p aria-live="polite" className="text-sm text-neutral-700">
          Pronto — você entrou em {matricularMutation.data.nome}.
        </p>
      ) : null}

      <Button type="submit" isLoading={matricularMutation.isPending} loadingLabel="Entrando…">
        Entrar na turma
      </Button>
    </form>
  )
}

export default EntrarTurmaForm
