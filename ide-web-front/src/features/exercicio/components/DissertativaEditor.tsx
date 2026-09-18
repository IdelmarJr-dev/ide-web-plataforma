import type { ChangeEvent, ReactNode } from 'react'

interface DissertativaEditorProps {
  value: string
  onChange: (value: string) => void
}

/**
 * Campo de resposta dissertativa. Ainda sem persistência (RespostaDissertativa
 * chega numa próxima rodada) — por ora só o campo de texto.
 */
export const DissertativaEditor = ({ value, onChange }: DissertativaEditorProps): ReactNode => {
  return (
    <textarea
      className="h-full w-full resize-none rounded-md border border-neutral-300 p-3 text-sm outline-none
        focus-visible:ring-2 focus-visible:ring-primary-500"
      placeholder="Escreva sua resposta aqui…"
      value={value}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
        onChange(event.target.value)
      }}
    />
  )
}

export default DissertativaEditor
