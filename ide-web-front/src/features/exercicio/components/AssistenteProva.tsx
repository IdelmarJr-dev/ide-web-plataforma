import { useState } from 'react'
import type { ChangeEvent, ReactNode, SyntheticEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '~components/Button/Button'
import { Input } from '~components/Input/Input'
import { provaService } from '../services/provaService'
import type { NivelDificuldade } from '../types'

/**
 * Monta a prova a partir dos exercícios que a turma já tem sem prova. `Exercicio.prova_id`
 * é único, então montar prova é distribuir o acervo — daí mostrar quantos há antes de o
 * professor confirmar (Fase 10, D13).
 */
export const AssistenteProva = ({ turmaId }: { turmaId: string }): ReactNode => {
  const queryClient = useQueryClient()
  const [titulo, setTitulo] = useState('')
  const [quantidade, setQuantidade] = useState('5')
  const [nivel, setNivel] = useState('')
  const [prazo, setPrazo] = useState('')

  const acervoQuery = useQuery({
    queryKey: ['turmas', turmaId, 'provas', 'acervo'],
    queryFn: () => provaService.acervo(turmaId),
  })

  const montarMutation = useMutation({
    mutationFn: () =>
      provaService.montarComAssistente(turmaId, {
        titulo,
        quantidade: Number(quantidade),
        ...(nivel === '' ? {} : { nivel: nivel as NivelDificuldade }),
        ...(prazo === '' ? {} : { prazo: new Date(prazo).toISOString() }),
      }),
    onSuccess: () => {
      setTitulo('')
      void queryClient.invalidateQueries({ queryKey: ['turmas', turmaId, 'provas'] })
      void queryClient.invalidateQueries({ queryKey: ['turmas', turmaId, 'exercicios'] })
    },
  })

  // Tolerante a resposta malformada: sem acervo conhecido, o assistente só não avisa
  // de antemão — o backend recusa de qualquer jeito.
  const acervo = acervoQuery.data
  const porNivel = acervo?.porNivel
  const pedido = Number(quantidade)
  const disponivel = nivel === '' ? acervo?.total : porNivel?.[nivel as NivelDificuldade]
  const insuficiente = disponivel !== undefined && pedido > disponivel

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault()
    montarMutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-md border border-neutral-200 p-3" noValidate>
      <div>
        <h4 className="text-sm font-semibold text-neutral-900">Montar prova com o assistente</h4>
        <p className="mt-1 text-xs text-neutral-600">
          {porNivel === undefined
            ? 'Verificando quantos exercícios estão disponíveis…'
            : `A turma tem ${String(acervo?.total ?? 0)} exercício(s) sem prova: ` +
              `${String(porNivel.iniciante)} iniciante(s) e ${String(porNivel.intermediario)} intermediário(s).`}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="Título da prova"
          name="tituloProva"
          value={titulo}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setTitulo(event.target.value)
          }}
        />
        <Input
          label="Questões"
          name="quantidade"
          type="number"
          min={1}
          value={quantidade}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setQuantidade(event.target.value)
          }}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="nivelProva" className="text-sm font-medium text-neutral-900">
            Nível
          </label>
          <select
            id="nivelProva"
            name="nivelProva"
            value={nivel}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              setNivel(event.target.value)
            }}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          >
            <option value="">Qualquer nível</option>
            <option value="iniciante">Iniciante</option>
            <option value="intermediario">Intermediário</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="prazoProva" className="text-sm font-medium text-neutral-900">
            Prazo (opcional)
          </label>
          <input
            id="prazoProva"
            name="prazoProva"
            type="datetime-local"
            value={prazo}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setPrazo(event.target.value)
            }}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </div>
      </div>

      {/* Avisa antes de o professor clicar: prova pela metade é pior que erro claro. */}
      {insuficiente ? (
        <p className="text-xs text-danger-500">
          Você pediu {pedido} questões, mas só há {disponivel} exercício(s) disponível(is). Cadastre mais exercícios
          ou peça menos questões.
        </p>
      ) : null}

      {montarMutation.isError ? (
        <p role="alert" className="text-sm text-danger-500">
          {montarMutation.error.message}
        </p>
      ) : null}

      {montarMutation.isSuccess ? (
        <p className="text-sm text-success-700">
          Prova montada com {montarMutation.data.questoes} questão(ões).
        </p>
      ) : null}

      <div>
        <Button type="submit" isLoading={montarMutation.isPending} disabled={titulo.trim() === '' || insuficiente}>
          Montar prova
        </Button>
        {titulo.trim() === '' ? (
          <span className="ml-2 text-xs text-neutral-600">Dê um título à prova para continuar.</span>
        ) : null}
      </div>
    </form>
  )
}
