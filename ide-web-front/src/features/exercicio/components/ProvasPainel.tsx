import { useCallback, useState } from 'react'
import type { ChangeEvent, ReactNode, SyntheticEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '~components/Button/Button'
import { Input } from '~components/Input/Input'
import { provaService } from '../services/provaService'
import { AssistenteProva } from './AssistenteProva'
import { criarProvaSchema } from '../types'

interface ProvasPainelProps {
  turmaId: string
}

export const ProvasPainel = ({ turmaId }: ProvasPainelProps): ReactNode => {
  const [titulo, setTitulo] = useState('')
  const [erroTitulo, setErroTitulo] = useState<string | undefined>(undefined)
  const queryClient = useQueryClient()
  const queryKey = ['turmas', turmaId, 'provas']

  const provasQuery = useQuery({
    queryKey,
    queryFn: () => provaService.listarPorTurma(turmaId),
  })

  const criarMutation = useMutation({
    mutationFn: (tituloProva: string) => provaService.criar(turmaId, tituloProva),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey })
      setTitulo('')
    },
  })

  const sortearMutation = useMutation({
    mutationFn: () => provaService.sortear(turmaId),
  })

  const handleSubmit = useCallback(
    (event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault()

      const result = criarProvaSchema.safeParse({ turmaId, titulo })
      if (!result.success) {
        setErroTitulo(result.error.issues[0]?.message)
        return
      }

      setErroTitulo(undefined)
      criarMutation.mutate(result.data.titulo)
    },
    [turmaId, titulo, criarMutation],
  )

  const provas = provasQuery.data ?? []

  return (
    <div className="flex flex-col gap-3 rounded-md border border-neutral-200 p-3">
      <h4 className="text-sm font-semibold text-neutral-900">Provas (sorteio entre alunos)</h4>

      <AssistenteProva turmaId={turmaId} />

      {provasQuery.isLoading ? <p className="text-sm text-neutral-600">Carregando provas…</p> : null}

      {provas.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {provas.map((prova) => (
            <li key={prova.id} className="text-sm text-neutral-700">
              {prova.titulo}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-600">
          Nenhuma prova cadastrada — vincule exercícios a uma prova pra que só quem for sorteado com ela a veja.
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2" noValidate>
        <div className="flex-1">
          <Input
            label="Nova prova"
            name="tituloProva"
            value={titulo}
            onChange={(event: ChangeEvent<HTMLInputElement>) => { setTitulo(event.target.value) }}
            errorMessage={erroTitulo}
          />
        </div>
        <Button type="submit" isLoading={criarMutation.isPending}>
          Adicionar
        </Button>
      </form>

      {provas.length > 0 ? (
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            isLoading={sortearMutation.isPending}
            onClick={() => { sortearMutation.mutate() }}
          >
            Sortear provas entre os alunos
          </Button>
          {sortearMutation.isSuccess ? (
            <p role="status" className="text-xs text-neutral-600">
              {sortearMutation.data.alunosSorteados} aluno(s) sorteado(s) agora (quem já tinha prova não muda).
            </p>
          ) : null}
          {sortearMutation.isError ? (
            <p role="alert" className="text-xs text-danger-500">
              {sortearMutation.error.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default ProvasPainel
