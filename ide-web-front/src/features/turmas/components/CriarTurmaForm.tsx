import { useCallback, useState } from 'react'
import type { ChangeEvent, ReactNode, SyntheticEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '~components/Button/Button'
import { Input } from '~components/Input/Input'
import { TURMAS_QUERY_KEY } from '../hooks/queryKeys'
import { turmasService } from '../services/turmasService'
import { criarTurmaSchema, ROTULO_TURNO, TURNOS } from '../types'

interface FieldErrors {
  nome?: string
  disciplina?: string
  semestre?: string
}

/**
 * "Banco de Dados" era placeholder cinza e virava o valor gravado quando o campo ficava
 * vazio (`@default` do Prisma): o professor cadastrava outra disciplina sem perceber
 * (relatório de testes 2026-09-16, Fase 9 D18). Como valor inicial, o que será salvo
 * está visível e editável.
 */
const DISCIPLINA_PADRAO = 'Banco de Dados'

export const CriarTurmaForm = (): ReactNode => {
  const [nome, setNome] = useState('')
  const [disciplina, setDisciplina] = useState(DISCIPLINA_PADRAO)
  const [semestre, setSemestre] = useState('')
  const [turno, setTurno] = useState('')
  const [sala, setSala] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const queryClient = useQueryClient()

  const criarMutation = useMutation({
    mutationFn: turmasService.criar,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TURMAS_QUERY_KEY })
      setNome('')
      setDisciplina(DISCIPLINA_PADRAO)
      setSemestre('')
      setTurno('')
      setSala('')
    },
  })

  const handleSubmit = useCallback(
    (event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault()

      const result = criarTurmaSchema.safeParse({
        nome,
        semestre,
        ...(disciplina.trim() === '' ? {} : { disciplina }),
        ...(turno === '' ? {} : { turno }),
        ...(sala.trim() === '' ? {} : { sala }),
      })
      if (!result.success) {
        const errors: FieldErrors = {}
        for (const issue of result.error.issues) {
          const fieldName = issue.path[0]
          if (fieldName === 'nome' || fieldName === 'disciplina' || fieldName === 'semestre') {
            errors[fieldName] = issue.message
          }
        }
        setFieldErrors(errors)
        return
      }

      setFieldErrors({})
      criarMutation.mutate(result.data)
    },
    [nome, disciplina, semestre, turno, sala, criarMutation],
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Input
        label="Nome da turma"
        name="nome"
        value={nome}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          setNome(event.target.value)
        }}
        errorMessage={fieldErrors.nome}
      />
      <Input
        label="Disciplina"
        name="disciplina"
        value={disciplina}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          setDisciplina(event.target.value)
        }}
        errorMessage={fieldErrors.disciplina}
      />
      {/* Opcionais: servem pro professor filtrar o painel depois (Fase 10, D14). */}
      <div className="flex flex-col gap-1">
        <label htmlFor="turno" className="text-sm font-medium text-neutral-900">
          Turno (opcional)
        </label>
        <select
          id="turno"
          name="turno"
          value={turno}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            setTurno(event.target.value)
          }}
          className="rounded-md border border-neutral-300 p-2 text-sm"
        >
          <option value="">Sem turno definido</option>
          {TURNOS.map((opcao) => (
            <option key={opcao} value={opcao}>
              {ROTULO_TURNO[opcao]}
            </option>
          ))}
        </select>
      </div>
      <Input
        label="Sala (opcional)"
        name="sala"
        value={sala}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          setSala(event.target.value)
        }}
      />
      <Input
        label="Semestre"
        name="semestre"
        placeholder="2026.2"
        value={semestre}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          setSemestre(event.target.value)
        }}
        errorMessage={fieldErrors.semestre}
      />
      {criarMutation.isError ? (
        <p role="alert" className="text-sm text-danger-500">
          {criarMutation.error.message}
        </p>
      ) : null}
      {criarMutation.isSuccess ? (
        <p role="status" className="text-sm text-neutral-600">
          Turma criada. Código: <strong>{criarMutation.data.codigo}</strong>
        </p>
      ) : null}
      <Button type="submit" isLoading={criarMutation.isPending}>
        Criar turma
      </Button>
    </form>
  )
}

export default CriarTurmaForm
