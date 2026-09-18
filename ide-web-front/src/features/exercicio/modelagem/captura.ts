import { toPng } from 'html-to-image'

/** Imagem de um dos modelos, já pronta pro PDF (base64 sem o prefixo `data:`). */
export interface ImagemModelo {
  rotulo: string
  pngBase64: string
}

/** Registrado pelo editor e chamado pelo botão "Finalizar e baixar" (ver EditorModelagem). */
export type CapturarModelos = () => Promise<ImagemModelo[]>

const PREFIXO_DATA_URL_PNG = /^data:image\/png;base64,/

export async function capturarElemento(elemento: HTMLElement, rotulo: string): Promise<ImagemModelo | null> {
  if (elemento.clientWidth === 0 || elemento.clientHeight === 0) return null
  const dataUrl = await toPng(elemento)
  return { rotulo, pngBase64: dataUrl.replace(PREFIXO_DATA_URL_PNG, '') }
}

export function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
