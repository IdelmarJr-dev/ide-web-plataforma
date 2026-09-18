import { useCallback, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode, SyntheticEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '~components/Button/Button'
import { Input } from '~components/Input/Input'
import { exercicioService } from '../services/exercicioService'
import { provaService } from '../services/provaService'
import { GabaritoModelagemModal } from './modelagem/GabaritoModelagemModal'
import { DOCUMENTO_VAZIO, resumirDocumento } from '../modelagem/documento'
import type { DocumentoModelagem, ModoModelagem } from '../modelagem/documento'
import { ROTULOS_MODO_MODELAGEM } from '../modelagem/modos'
import { criarExercicioSchema, NIVEIS_DIFICULDADE } from '../types'
import type { NivelDificuldade } from '../types'

interface CriarExercicioFormProps {
  turmaId: string
}

interface FieldErrors {
  titulo?: string
  enunciado?: string
}

/** Ordem visual dos campos — o foco vai para o primeiro inválido de cima para baixo. */
const ORDEM_DOS_CAMPOS = ['titulo', 'enunciado'] as const

/**
 * O formulário é longo e o botão fica no fim: o erro aparecia no topo, fora da tela, e o
 * professor só via o clique "não fazer nada" (relatório de testes 2026-09-16, Fase 9 D21).
 * Focar resolve para mouse, teclado e leitor de tela de uma vez.
 */
function focarPrimeiroCampoInvalido(form: HTMLFormElement | null, errors: FieldErrors): void {
  if (!form) return

  const primeiro = ORDEM_DOS_CAMPOS.find((campo) => errors[campo] !== undefined)
  if (!primeiro) return

  const elemento = form.elements.namedItem(primeiro)
  if (elemento instanceof HTMLInputElement || elemento instanceof HTMLTextAreaElement) {
    // `focus()` já rola o campo para a tela; `scrollIntoView` seria redundante.
    elemento.focus()
  }
}

const NIVEL_LABELS: Record<NivelDificuldade, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
}

export const CriarExercicioForm = ({ turmaId }: CriarExercicioFormProps): ReactNode => {
  const [titulo, setTitulo] = useState('')
  const [enunciado, setEnunciado] = useState('')
  const [nivelDificuldade, setNivelDificuldade] = useState<NivelDificuldade>('iniciante')
  const [publico, setPublico] = useState(false)
  const [prazo, setPrazo] = useState('')
  const [sqlGabarito, setSqlGabarito] = useState('')
  const [sqlSetup, setSqlSetup] = useState('')
  const [gabaritoDissertativo, setGabaritoDissertativo] = useState('')
  const [provaId, setProvaId] = useState('')
  const [merGabarito, setMerGabarito] = useState<{ documento: DocumentoModelagem; modo: ModoModelagem } | null>(null)
  const [isGabaritoMerAberto, setIsGabaritoMerAberto] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const formRef = useRef<HTMLFormElement>(null)
  const queryClient = useQueryClient()

  const provasQuery = useQuery({
    queryKey: ['turmas', turmaId, 'provas'],
    queryFn: () => provaService.listarPorTurma(turmaId),
  })

  const criarMutation = useMutation({
    mutationFn: exercicioService.criar,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['turmas', turmaId, 'exercicios'] })
      setTitulo('')
      setEnunciado('')
      setPrazo('')
      setSqlGabarito('')
      setSqlSetup('')
      setGabaritoDissertativo('')
      setProvaId('')
      setMerGabarito(null)
      setPublico(false)
    },
  })

  const handleSubmit = useCallback(
    (event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault()

      const result = criarExercicioSchema.safeParse({
        turmaId,
        titulo,
        enunciado,
        nivelDificuldade,
        ...(prazo === '' ? {} : { prazo: new Date(prazo).toISOString() }),
        publico,
        ...(provaId === '' ? {} : { provaId }),
        ...(sqlGabarito.trim() === '' ? {} : { sqlGabarito }),
        ...(sqlSetup.trim() === '' ? {} : { sqlSetup }),
        ...(gabaritoDissertativo.trim() === '' ? {} : { gabaritoDissertativo }),
        ...(merGabarito ? { merGabarito: merGabarito.documento, modoMer: merGabarito.modo } : {}),
      })
      if (!result.success) {
        const errors: FieldErrors = {}
        for (const issue of result.error.issues) {
          const fieldName = issue.path[0]
          if (fieldName === 'titulo' || fieldName === 'enunciado') {
            errors[fieldName] = issue.message
          }
        }
        setFieldErrors(errors)
        focarPrimeiroCampoInvalido(formRef.current, errors)
        return
      }

      setFieldErrors({})
      criarMutation.mutate(result.data)
    },
    [
      turmaId,
      titulo,
      enunciado,
      nivelDificuldade,
      prazo,
      publico,
      provaId,
      sqlGabarito,
      sqlSetup,
      gabaritoDissertativo,
      merGabarito,
      criarMutation,
    ],
  )

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Input
        label="Título"
        name="titulo"
        value={titulo}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          setTitulo(event.target.value)
        }}
        errorMessage={fieldErrors.titulo}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="enunciado" className="text-sm font-medium text-neutral-900">
          Enunciado
        </label>
        <textarea
          id="enunciado"
          name="enunciado"
          value={enunciado}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            setEnunciado(event.target.value)
          }}
          className="min-h-24 rounded-md border border-neutral-300 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        />
        {fieldErrors.enunciado ? (
          <p role="alert" className="text-sm text-danger-500">
            {fieldErrors.enunciado}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="nivelDificuldade" className="text-sm font-medium text-neutral-900">
          Nível
        </label>
        <select
          id="nivelDificuldade"
          name="nivelDificuldade"
          value={nivelDificuldade}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            setNivelDificuldade(event.target.value as NivelDificuldade)
          }}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {NIVEIS_DIFICULDADE.map((nivel) => (
            <option key={nivel} value={nivel}>
              {NIVEL_LABELS[nivel]}
            </option>
          ))}
        </select>
      </div>
      {/* D7: prazo opcional; sem data preenchida, a atividade não vence. */}
      <div className="flex flex-col gap-1">
        <label htmlFor="prazo" className="text-sm font-medium text-neutral-900">
          Prazo de entrega (opcional)
        </label>
        <input
          id="prazo"
          name="prazo"
          type="datetime-local"
          value={prazo}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setPrazo(event.target.value)
          }}
          className="rounded-md border border-neutral-300 p-2 text-sm"
        />
        <p className="text-xs text-neutral-600">
          {prazo === '' ? 'Sem prazo: o aluno entrega quando quiser.' : 'Depois desta data o aluno não entrega mais.'}
        </p>
      </div>
      <label className="flex items-start gap-2 text-sm text-neutral-900">
        <input
          type="checkbox"
          name="publico"
          checked={publico}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setPublico(event.target.checked)
          }}
          className="mt-1"
        />
        <span>
          Publicar pra qualquer aluno
          <span className="mt-0.5 block text-xs font-normal text-neutral-600">
            Aparece no estudo livre, fora da turma. A correção é automática — ninguém revisa essas tentativas à mão.
          </span>
        </span>
      </label>
      {provasQuery.data && provasQuery.data.length > 0 ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="provaId" className="text-sm font-medium text-neutral-900">
            Prova (opcional)
          </label>
          <select
            id="provaId"
            name="provaId"
            value={provaId}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => { setProvaId(event.target.value) }}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <option value="">Nenhuma — todos os alunos veem</option>
            {provasQuery.data.map((prova) => (
              <option key={prova.id} value={prova.id}>
                {prova.titulo}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <Input
          label="Gabarito SQL (opcional)"
          name="sqlGabarito"
          value={sqlGabarito}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setSqlGabarito(event.target.value)
          }}
        />
        {/* Sem gabarito não há correção automática, e isso não era dito em lugar nenhum:
            o professor publicava o exercício sem saber (Fase 9, D15). */}
        {sqlGabarito.trim() === '' ? (
          <p className="text-xs text-neutral-600">
            Sem gabarito SQL não há correção automática: o aluno envia a resposta e você corrige à mão.
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="sqlSetup" className="text-sm font-medium text-neutral-900">
          Setup do sandbox SQL (opcional)
        </label>
        <textarea
          id="sqlSetup"
          name="sqlSetup"
          value={sqlSetup}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            setSqlSetup(event.target.value)
          }}
          placeholder="CREATE TABLE ... ; INSERT INTO ... ;"
          className="min-h-24 rounded-md border border-neutral-300 p-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        />
        <p className="text-xs text-neutral-500">
          Script de dados-exemplo (CREATE TABLE + INSERT) que o aluno vai consultar no sandbox. Sem isso, o aluno
          testa/envia SQL contra um schema vazio.
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="gabaritoDissertativo" className="text-sm font-medium text-neutral-900">
          Gabarito dissertativo (opcional)
        </label>
        <textarea
          id="gabaritoDissertativo"
          name="gabaritoDissertativo"
          value={gabaritoDissertativo}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            setGabaritoDissertativo(event.target.value)
          }}
          className="min-h-16 rounded-md border border-neutral-300 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-neutral-900">Parte de modelagem (opcional)</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => { setIsGabaritoMerAberto(true) }}>
            {merGabarito ? 'Editar modelagem' : 'Desenhar gabarito da modelagem'}
          </Button>
          {merGabarito ? (
            <>
              <span className="text-xs text-neutral-600">
                {ROTULOS_MODO_MODELAGEM[merGabarito.modo]} · {resumirDocumento(merGabarito.documento)}
              </span>
              <Button variant="ghost" onClick={() => { setMerGabarito(null) }}>
                Remover
              </Button>
            </>
          ) : null}
        </div>
        <p className="text-xs text-neutral-500">
          Com gabarito de modelagem, o aluno vê o editor de modelagem ao lado do editor SQL.
        </p>
      </div>
      {isGabaritoMerAberto ? (
        <GabaritoModelagemModal
          documentoInicial={merGabarito?.documento ?? DOCUMENTO_VAZIO}
          modoInicial={merGabarito?.modo ?? 'conceitual_logico'}
          onClose={() => { setIsGabaritoMerAberto(false) }}
          onSalvar={(gabarito) => {
            setMerGabarito(gabarito)
            setIsGabaritoMerAberto(false)
          }}
        />
      ) : null}
      {criarMutation.isError ? (
        <p role="alert" className="text-sm text-danger-500">
          {criarMutation.error.message}
        </p>
      ) : null}
      <Button type="submit" isLoading={criarMutation.isPending}>
        Criar exercício
      </Button>
    </form>
  )
}

export default CriarExercicioForm
