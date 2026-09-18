import { useEffect, useMemo, useRef, useState } from 'react'
import type { DocumentoModelagem } from './documento'
import { erroDeValidacao } from './documento'

export type StatusSalvamento =
  | { estado: 'salvo'; em: Date | null }
  | { estado: 'pendente' }
  | { estado: 'salvando' }
  | { estado: 'erro' }
  | { estado: 'invalido'; mensagem: string }

export const ATRASO_AUTOSAVE_MS = 1500
const ESPERA_MAXIMA_RETRY_MS = 30_000

export function esperaDaTentativa(tentativa: number): number {
  return Math.min(2000 * 2 ** Math.max(tentativa - 1, 0), ESPERA_MAXIMA_RETRY_MS)
}

/**
 * Salvamento automático do documento de modelagem: espera o aluno parar de mexer,
 * valida com o mesmo schema do backend (não manda o que seria recusado), nunca
 * dispara dois PUTs em paralelo e, se falhar, tenta de novo com espera crescente.
 * Avisa o navegador ao fechar a página com alteração pendente.
 */
export function useAutosaveModelagem(
  documento: DocumentoModelagem,
  salvar: (documento: DocumentoModelagem) => Promise<unknown>,
): StatusSalvamento {
  const chave = useMemo(() => JSON.stringify(documento), [documento])
  const [chaveSalva, setChaveSalva] = useState(chave)
  const [salvoEm, setSalvoEm] = useState<Date | null>(null)
  const [chaveEmVoo, setChaveEmVoo] = useState<string | null>(null)
  const [tentativasComErro, setTentativasComErro] = useState(0)

  const salvarRef = useRef(salvar)
  const documentoRef = useRef(documento)
  const emVooRef = useRef<Promise<unknown> | null>(null)
  const pendenteRef = useRef(false)

  const mensagemInvalido = useMemo(() => (chave === chaveSalva ? null : erroDeValidacao(documento)), [chave, chaveSalva, documento])

  useEffect(() => {
    salvarRef.current = salvar
    documentoRef.current = documento
  })

  useEffect(() => {
    if (chave === chaveSalva || mensagemInvalido !== null) return

    const espera = tentativasComErro > 0 ? esperaDaTentativa(tentativasComErro) : ATRASO_AUTOSAVE_MS
    const timer = setTimeout(() => {
      const executar = async (): Promise<void> => {
        await emVooRef.current?.catch(() => undefined)
        setChaveEmVoo(chave)
        const envio = salvarRef.current(documentoRef.current)
        emVooRef.current = envio
        try {
          await envio
          setChaveSalva(chave)
          setSalvoEm(new Date())
          setTentativasComErro(0)
        } catch {
          setTentativasComErro((atual) => atual + 1)
        } finally {
          setChaveEmVoo(null)
        }
      }
      void executar()
    }, espera)
    return () => { clearTimeout(timer) }
  }, [chave, chaveSalva, mensagemInvalido, tentativasComErro])

  const status: StatusSalvamento =
    mensagemInvalido !== null
      ? { estado: 'invalido', mensagem: mensagemInvalido }
      : chave === chaveSalva
        ? { estado: 'salvo', em: salvoEm }
        : chaveEmVoo !== null
          ? { estado: 'salvando' }
          : tentativasComErro > 0
            ? { estado: 'erro' }
            : { estado: 'pendente' }

  const temPendencia = status.estado !== 'salvo'
  useEffect(() => {
    pendenteRef.current = temPendencia
    if (!temPendencia) return
    const avisar = (evento: BeforeUnloadEvent): void => { evento.preventDefault() }
    window.addEventListener('beforeunload', avisar)
    return () => { window.removeEventListener('beforeunload', avisar) }
  }, [temPendencia])

  // Saindo da tela (ex.: "Voltar à turma") com alteração pendente: último envio sem esperar.
  useEffect(
    () => () => {
      if (pendenteRef.current && erroDeValidacao(documentoRef.current) === null) {
        void salvarRef.current(documentoRef.current).catch(() => undefined)
      }
    },
    [],
  )

  return status
}
