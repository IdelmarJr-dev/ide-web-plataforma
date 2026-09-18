import { useCallback, useMemo } from 'react'
import type { Conversao, DocumentoModelagem, ModeloConceitual, ModeloLogico } from './documento'
import { CONCEITUAL_VAZIO, LOGICO_VAZIO } from './documento'
import { useHistorico } from './historico'

export interface DocumentoEditavel {
  documento: DocumentoModelagem
  aplicar: (atualizar: (documento: DocumentoModelagem) => DocumentoModelagem, chave?: string) => void
  aplicarLogico: (atualizar: (logico: ModeloLogico) => ModeloLogico, chave?: string) => void
  aplicarConceitual: (atualizar: (conceitual: ModeloConceitual) => ModeloConceitual, chave?: string) => void
  // Conversão troca o lógico inteiro e registra a assinatura do conceitual: um passo só do histórico.
  aplicarConversao: (logico: ModeloLogico, conversao: Conversao) => void
  controle: {
    podeDesfazer: boolean
    podeRefazer: boolean
    desfazer: () => void
    refazer: () => void
    encerrarGesto: () => void
  }
}

/** Documento de modelagem com desfazer/refazer — o histórico cobre os dois modelos juntos. */
export function useDocumentoEditavel(inicial: DocumentoModelagem): DocumentoEditavel {
  const { valor, aplicar, desfazer, refazer, encerrarGesto, podeDesfazer, podeRefazer } = useHistorico(inicial)

  const aplicarDocumento = useCallback(
    (atualizar: (documento: DocumentoModelagem) => DocumentoModelagem, chave?: string) => {
      aplicar(atualizar, chave)
    },
    [aplicar],
  )

  const aplicarLogico = useCallback(
    (atualizar: (logico: ModeloLogico) => ModeloLogico, chave?: string) => {
      aplicar((documento) => {
        const atual = documento.logico ?? LOGICO_VAZIO
        const novo = atualizar(atual)
        return novo === atual ? documento : { ...documento, logico: novo }
      }, chave)
    },
    [aplicar],
  )

  const aplicarConceitual = useCallback(
    (atualizar: (conceitual: ModeloConceitual) => ModeloConceitual, chave?: string) => {
      aplicar((documento) => {
        const atual = documento.conceitual ?? CONCEITUAL_VAZIO
        const novo = atualizar(atual)
        return novo === atual ? documento : { ...documento, conceitual: novo }
      }, chave)
    },
    [aplicar],
  )

  const aplicarConversao = useCallback(
    (logico: ModeloLogico, conversao: Conversao) => {
      aplicar((documento) => ({ ...documento, logico, conversao }))
    },
    [aplicar],
  )

  const controle = useMemo(
    () => ({ podeDesfazer, podeRefazer, desfazer, refazer, encerrarGesto }),
    [podeDesfazer, podeRefazer, desfazer, refazer, encerrarGesto],
  )

  return {
    documento: valor,
    aplicar: aplicarDocumento,
    aplicarLogico,
    aplicarConceitual,
    aplicarConversao,
    controle,
  }
}
