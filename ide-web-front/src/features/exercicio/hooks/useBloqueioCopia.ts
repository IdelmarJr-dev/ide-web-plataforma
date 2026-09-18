import { useEffect } from 'react'

/**
 * Intercepta copiar/colar/recortar e o menu de contexto durante uma questão de prova.
 *
 * É **dissuasão, não controle**: detém o aluno desatento, e não detém quem usa celular,
 * segundo monitor ou as ferramentas do navegador. Registrado assim em Fase 10, D11 —
 * o texto do TCC não pode afirmar que a plataforma impede consulta externa.
 */
export function useBloqueioCopia(ativo: boolean): void {
  useEffect(() => {
    if (!ativo) return undefined

    const bloquear = (evento: Event): void => {
      evento.preventDefault()
    }

    const eventos = ['copy', 'cut', 'paste', 'contextmenu'] as const
    for (const nome of eventos) {
      document.addEventListener(nome, bloquear)
    }

    return () => {
      for (const nome of eventos) {
        document.removeEventListener(nome, bloquear)
      }
    }
  }, [ativo])
}
