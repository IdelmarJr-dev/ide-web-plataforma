import { useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '~components/Button/Button'
import { Modal } from '~components/Modal/Modal'
import { triggerDownload } from '../../../lib/downloadBlob'
import type { CapturarModelos } from '../modelagem/captura'
import { exercicioService } from '../services/exercicioService'

interface FinalizarPacoteButtonProps {
  exercicioId: string
  // Ausente quando o exercício não tem parte de modelagem.
  capturaRef?: RefObject<CapturarModelos | null> | undefined
  // SQL gerado do modelo lógico (nenhum no modo puramente conceitual).
  sqlModelo?: string | undefined
}

/**
 * Duas ações separadas desde a Fase 8. "Baixar PDF" monta o arquivo com o enunciado e
 * o que o aluno respondeu, quantas vezes ele quiser, sem efeito colateral nenhum.
 * "Finalizar" encerra o exercício: marca a data e apaga o banco do sandbox — por isso
 * pede confirmação de quem ainda não levou o arquivo.
 */
export const FinalizarPacoteButton = ({
  exercicioId,
  capturaRef,
  sqlModelo,
}: FinalizarPacoteButtonProps): ReactNode => {
  const [jaBaixou, setJaBaixou] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const navigate = useNavigate()

  const baixarMutation = useMutation({
    mutationFn: async (): Promise<Blob> => {
      const imagens = (await capturaRef?.current?.()) ?? []
      return exercicioService.baixarPacote(exercicioId, {
        imagens,
        ...(sqlModelo === undefined || sqlModelo.trim() === '' ? {} : { sqlModelo }),
      })
    },
    onSuccess: (blob) => {
      triggerDownload(blob, `exercicio-${exercicioId}.pdf`)
      setJaBaixou(true)
    },
  })

  const finalizarMutation = useMutation({
    mutationFn: () => exercicioService.finalizar(exercicioId),
    onSuccess: () => {
      setConfirmando(false)
      void navigate('/dashboard')
    },
  })

  const erro = baixarMutation.error ?? finalizarMutation.error

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          isLoading={baixarMutation.isPending}
          loadingLabel="Gerando PDF…"
          onClick={() => {
            baixarMutation.mutate()
          }}
        >
          Baixar PDF
        </Button>
        <Button
          onClick={() => {
            setConfirmando(true)
          }}
        >
          Finalizar
        </Button>
      </div>

      {baixarMutation.isPending ? (
        <p aria-live="polite" className="text-xs text-neutral-600">
          Fotografando o modelo e montando o arquivo — alguns segundos.
        </p>
      ) : null}

      {erro ? (
        <p role="alert" className="text-sm text-danger-500">
          {erro.message}
        </p>
      ) : null}

      <Modal
        title={jaBaixou ? 'Finalizar o exercício?' : 'Finalizar sem baixar o PDF?'}
        isOpen={confirmando}
        onClose={() => {
          setConfirmando(false)
        }}
      >
        <p className="text-sm text-neutral-700">
          {jaBaixou
            ? 'O exercício será marcado como concluído e o banco de testes dele será apagado. Suas respostas enviadas continuam salvas.'
            : 'Você ainda não baixou o PDF deste exercício. Ao finalizar, o banco de testes é apagado e o arquivo deixa de mostrar o que estava no sandbox.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            isLoading={finalizarMutation.isPending}
            loadingLabel="Finalizando…"
            onClick={() => {
              finalizarMutation.mutate()
            }}
          >
            Finalizar
          </Button>
          {jaBaixou ? null : (
            <Button
              variant="ghost"
              isLoading={baixarMutation.isPending}
              loadingLabel="Gerando PDF…"
              onClick={() => {
                baixarMutation.mutate()
              }}
            >
              Baixar antes
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              setConfirmando(false)
            }}
          >
            Cancelar
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default FinalizarPacoteButton
