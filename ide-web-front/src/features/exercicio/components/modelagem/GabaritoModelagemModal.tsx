import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '~components/Button/Button'
import { Modal } from '~components/Modal/Modal'
import type { DocumentoModelagem, ModoModelagem } from '../../modelagem/documento'
import { documentoTemConteudo, erroDeValidacao, MODOS_MODELAGEM } from '../../modelagem/documento'
import { ROTULOS_MODO_MODELAGEM } from '../../modelagem/modos'
import { useDocumentoEditavel } from '../../modelagem/useDocumentoEditavel'
import { EditorModelagem } from './EditorModelagem'

interface GabaritoModelagemModalProps {
  documentoInicial: DocumentoModelagem
  modoInicial: ModoModelagem
  onClose: () => void
  onSalvar: (gabarito: { documento: DocumentoModelagem; modo: ModoModelagem }) => void
  isSalvando?: boolean
  erro?: string | null
}

/**
 * Professor define o nível da modelagem e desenha o gabarito no mesmo editor do aluno
 * (sem autosave: só vale ao clicar em "Usar gabarito"). Renderizar só quando aberto.
 */
export const GabaritoModelagemModal = ({
  documentoInicial,
  modoInicial,
  onClose,
  onSalvar,
  isSalvando = false,
  erro = null,
}: GabaritoModelagemModalProps): ReactNode => {
  const editavel = useDocumentoEditavel(documentoInicial)
  const [modo, setModo] = useState<ModoModelagem>(modoInicial)
  const invalido = erroDeValidacao(editavel.documento)

  return (
    <Modal title="Modelagem do exercício" isOpen onClose={onClose} size="xl" fecharComEsc={false}>
      <div className="flex h-[75vh] flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-900">
            Nível da modelagem
            <select
              value={modo}
              onChange={(evento) => { setModo(evento.target.value as ModoModelagem) }}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {MODOS_MODELAGEM.map((opcao) => (
                <option key={opcao} value={opcao}>{ROTULOS_MODO_MODELAGEM[opcao]}</option>
              ))}
            </select>
          </label>
          <p className="max-w-md text-xs text-neutral-600">
            O aluno modela nesse nível. Em &quot;Conceitual → Lógico&quot; ele desenha o MER e converte em tabelas pelo
            assistente.
          </p>
        </div>
        <div className="min-h-0 flex-1">
          <EditorModelagem editavel={editavel} modo={modo} />
        </div>
        {invalido || erro ? (
          <p role="alert" className="text-sm text-danger-600">{erro ?? invalido}</p>
        ) : null}
        <div className="flex items-center justify-end gap-2">
          {/* Botão desabilitado sem explicação lia-se como falha silenciosa
              (relatório de testes 2026-09-16, Fase 9 D20). */}
          {!documentoTemConteudo(editavel.documento) ? (
            <span id="motivo-gabarito-desabilitado" className="text-xs text-neutral-600">
              Desenhe ao menos uma entidade para usar como gabarito.
            </span>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            isLoading={isSalvando}
            disabled={!documentoTemConteudo(editavel.documento) || invalido !== null}
            aria-describedby={
              documentoTemConteudo(editavel.documento) ? undefined : 'motivo-gabarito-desabilitado'
            }
            onClick={() => { onSalvar({ documento: editavel.documento, modo }) }}
          >
            Usar gabarito
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default GabaritoModelagemModal
