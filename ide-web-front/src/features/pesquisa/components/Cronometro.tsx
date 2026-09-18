import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

const MS_POR_SEGUNDO = 1000
const SEGUNDOS_POR_MINUTO = 60
// Protocolo do TCC (seção 5.4): execução das tarefas em até 60 min. Só referência —
// a tarefa não é encerrada automaticamente.
const REFERENCIA_MINUTOS = 60

function formatar(totalSegundos: number): string {
  const minutos = Math.floor(totalSegundos / SEGUNDOS_POR_MINUTO)
  const segundos = totalSegundos % SEGUNDOS_POR_MINUTO
  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`
}

export const Cronometro = ({ inicio }: { inicio: string }): ReactNode => {
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    const intervalo = setInterval(() => { setAgora(Date.now()) }, MS_POR_SEGUNDO)
    return () => { clearInterval(intervalo) }
  }, [])

  const decorridos = Math.max(0, Math.floor((agora - new Date(inicio).getTime()) / MS_POR_SEGUNDO))
  const passouDaReferencia = decorridos >= REFERENCIA_MINUTOS * SEGUNDOS_POR_MINUTO

  return (
    <p className={`text-sm ${passouDaReferencia ? 'text-danger-500' : 'text-neutral-600'}`}>
      Tempo de tarefa: <span className="font-mono font-medium">{formatar(decorridos)}</span> (referência:{' '}
      {REFERENCIA_MINUTOS} min)
    </p>
  )
}

export default Cronometro
