import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { HttpError } from '../../../lib/httpClient'
import { exercicioService } from '../services/exercicioService'

const ESPERA_ANTES_DE_SALVAR_MS = 1500

interface DissertativaEditorProps {
  exercicioId: string
}

function horaCurta(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function mensagemDeFalha(erro: Error): string {
  if (erro instanceof HttpError) return erro.message
  return 'Sem conexão com o servidor: sua resposta ainda não foi salva.'
}

/**
 * Resposta dissertativa, salva sozinha alguns instantes depois que o aluno para de digitar.
 * Antes o texto só existia no navegador: a revisão do professor e o PDF liam uma tabela que
 * nada preenchia. Mostra se há alteração não salva e avisa ao sair da página nesse estado.
 */
export const DissertativaEditor = ({ exercicioId }: DissertativaEditorProps): ReactNode => {
  const rotuloId = useId()
  const [texto, setTexto] = useState('')
  const [pendente, setPendente] = useState(false)
  const carregado = useRef(false)
  // O que está no campo agora: um salvamento que termina depois de nova digitação não marca como salvo.
  const textoAtual = useRef('')

  const respostaQuery = useQuery({
    queryKey: ['exercicios', exercicioId, 'dissertativa'],
    queryFn: () => exercicioService.buscarDissertativa(exercicioId),
  })

  const salvarMutation = useMutation({
    mutationFn: (valor: string) => exercicioService.salvarDissertativa(exercicioId, valor),
    onSuccess: (_resposta, valorSalvo) => {
      if (valorSalvo === textoAtual.current) setPendente(false)
    },
  })
  const { mutate: salvar } = salvarMutation

  // Preenche o campo uma vez com o que já estava salvo, sem atropelar o que o aluno digitar depois.
  useEffect(() => {
    if (carregado.current || respostaQuery.status !== 'success') return
    carregado.current = true
    textoAtual.current = respostaQuery.data?.texto ?? ''
    setTexto(textoAtual.current)
  }, [respostaQuery.status, respostaQuery.data])

  useEffect(() => {
    if (!pendente) return
    const espera = setTimeout(() => {
      salvar(texto)
    }, ESPERA_ANTES_DE_SALVAR_MS)
    return () => {
      clearTimeout(espera)
    }
  }, [pendente, texto, salvar])

  useEffect(() => {
    if (!pendente) return
    const avisar = (evento: BeforeUnloadEvent): void => {
      evento.preventDefault()
    }
    window.addEventListener('beforeunload', avisar)
    return () => {
      window.removeEventListener('beforeunload', avisar)
    }
  }, [pendente])

  let estado: ReactNode = null
  if (respostaQuery.isError) {
    estado = <span className="text-danger-500">Não deu para carregar sua resposta salva.</span>
  } else if (salvarMutation.isError) {
    estado = (
      <span role="alert" className="text-danger-500">
        {mensagemDeFalha(salvarMutation.error)}{' '}
        <button type="button" className="font-medium underline" onClick={() => { salvar(texto) }}>
          Tentar de novo
        </button>
      </span>
    )
  } else if (salvarMutation.isPending) {
    estado = <span className="text-neutral-600">Salvando…</span>
  } else if (pendente) {
    estado = <span className="text-neutral-600">Alteração ainda não salva</span>
  } else if (salvarMutation.data) {
    estado = <span className="text-neutral-600">Salvo às {horaCurta(salvarMutation.data.atualizadoEm)}</span>
  } else if (respostaQuery.data) {
    estado = <span className="text-neutral-600">Salvo às {horaCurta(respostaQuery.data.atualizadoEm)}</span>
  }

  return (
    <div className="flex h-full flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <label htmlFor={rotuloId} className="text-sm font-medium text-neutral-900">
          Sua resposta
        </label>
        <span aria-live="polite">{estado}</span>
      </div>
      <textarea
        id={rotuloId}
        className="min-h-24 w-full flex-1 resize-none rounded-md border border-neutral-300 p-3 text-sm outline-none
          focus-visible:ring-2 focus-visible:ring-primary-500"
        placeholder="Escreva sua resposta aqui…"
        value={texto}
        disabled={respostaQuery.isLoading}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          textoAtual.current = event.target.value
          setTexto(event.target.value)
          setPendente(true)
        }}
      />
    </div>
  )
}

export default DissertativaEditor
