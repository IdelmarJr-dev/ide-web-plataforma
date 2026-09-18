import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import type { ModoModelagem } from '../../modelagem/documento'
import { CONCEITUAL_VAZIO, LOGICO_VAZIO } from '../../modelagem/documento'
import { capturarElemento, esperar } from '../../modelagem/captura'
import type { CapturarModelos, ImagemModelo } from '../../modelagem/captura'
import type { Selecao } from '../../modelagem/sincronizacao'
import type { DocumentoEditavel } from '../../modelagem/useDocumentoEditavel'
import { ConceitualEditor } from './conceitual/ConceitualEditor'
import { ConceitualLogicoEditor } from './ConceitualLogicoEditor'
import type { AbaModelo } from './ConceitualLogicoEditor'
import { LogicoEditor } from './logico/LogicoEditor'

interface EditorModelagemProps {
  editavel: DocumentoEditavel
  modo: ModoModelagem
  somenteLeitura?: boolean
  destaque?: Selecao | null
  onSelecionar?: (selecao: Selecao) => void
  barraDireita?: ReactNode
  // Preenchido com a função que tira as imagens dos modelos (PDF do exercício).
  capturaRef?: RefObject<CapturarModelos | null> | undefined
}

const ROTULO_MODELO: Record<AbaModelo, string> = {
  conceitual: 'Modelo conceitual',
  logico: 'Modelo lógico',
}

// Trocar de aba remonta o React Flow; ele precisa de alguns quadros pra medir os nós e
// desenhar as linhas antes do print. Só o suficiente: essa espera é o tempo que o aluno
// fica olhando pro botão depois de clicar em "Finalizar e baixar".
const ESPERA_RENDER_MS = 250

/**
 * Escolhe o editor conforme o modo. Usado pelo aluno (com autosave) e pelo professor
 * (gabarito). `modos.ts` só libera modos com editor pronto.
 */
export const EditorModelagem = ({
  editavel,
  modo,
  somenteLeitura = false,
  destaque = null,
  onSelecionar,
  barraDireita,
  capturaRef,
}: EditorModelagemProps): ReactNode => {
  const canvasRef = useRef<HTMLDivElement>(null)
  // Enquanto captura, o modo conceitual → lógico mostra a aba pedida em vez da escolhida.
  const [abaForcada, setAbaForcada] = useState<AbaModelo | null>(null)
  const { documento } = editavel
  const temConceitual = (documento.conceitual?.elementos.length ?? 0) > 0
  const temLogico = (documento.logico?.tabelas.length ?? 0) > 0

  const capturar = useCallback(async (): Promise<ImagemModelo[]> => {
    const canvas = (): HTMLDivElement | null => canvasRef.current
    if (modo !== 'conceitual_logico') {
      const atual = canvas()
      const imagem = atual ? await capturarElemento(atual, ROTULO_MODELO[modo]) : null
      return imagem ? [imagem] : []
    }

    const abas: AbaModelo[] = [...(temConceitual ? (['conceitual'] as const) : []), ...(temLogico ? (['logico'] as const) : [])]
    if (abas.length === 0) return []

    const imagens: ImagemModelo[] = []
    for (const aba of abas) {
      setAbaForcada(aba)
      await esperar(ESPERA_RENDER_MS)
      const atual = canvas()
      const imagem = atual ? await capturarElemento(atual, ROTULO_MODELO[aba]) : null
      if (imagem) imagens.push(imagem)
    }
    setAbaForcada(null)
    return imagens
  }, [modo, temConceitual, temLogico])

  useEffect(() => {
    if (!capturaRef) return
    capturaRef.current = capturar
    return () => {
      capturaRef.current = null
    }
  }, [capturaRef, capturar])

  if (modo === 'conceitual_logico') {
    return (
      <ConceitualLogicoEditor
        editavel={editavel}
        somenteLeitura={somenteLeitura}
        destaque={destaque}
        {...(onSelecionar ? { onSelecionar } : {})}
        barraDireita={barraDireita}
        canvasRef={canvasRef}
        abaForcada={abaForcada}
      />
    )
  }

  if (modo === 'conceitual') {
    return (
      <ConceitualEditor
        conceitual={documento.conceitual ?? CONCEITUAL_VAZIO}
        onAplicar={editavel.aplicarConceitual}
        historico={editavel.controle}
        somenteLeitura={somenteLeitura}
        barraDireita={barraDireita}
        canvasRef={canvasRef}
      />
    )
  }

  return (
    <LogicoEditor
      logico={documento.logico ?? LOGICO_VAZIO}
      onAplicar={editavel.aplicarLogico}
      historico={editavel.controle}
      somenteLeitura={somenteLeitura}
      destaque={destaque}
      {...(onSelecionar ? { onSelecionar } : {})}
      barraDireita={barraDireita}
      canvasRef={canvasRef}
    />
  )
}

export default EditorModelagem
