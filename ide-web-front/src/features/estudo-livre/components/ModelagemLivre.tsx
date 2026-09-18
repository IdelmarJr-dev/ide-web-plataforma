import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Button } from '~components/Button/Button'
import { EditorModelagem } from '~features/exercicio/components/modelagem/EditorModelagem'
import { DOCUMENTO_VAZIO, LOGICO_VAZIO } from '~features/exercicio/modelagem/documento'
import { gerarSql } from '~features/exercicio/modelagem/gerarSql'
import { useDocumentoEditavel } from '~features/exercicio/modelagem/useDocumentoEditavel'

interface ModelagemLivreProps {
  // Leva o DDL do modelo pro banco livre, onde o aluno pode rodá-lo de verdade.
  onUsarSql: (sql: string) => void
}

/**
 * Modelagem sem exercício: rascunho que vive só no navegador (nada é salvo no
 * servidor — decisão D7 da Fase 8). O ganho é poder gerar o SQL do modelo e executá-lo
 * no banco livre, fechando o ciclo modelar → gerar → consultar.
 */
export const ModelagemLivre = ({ onUsarSql }: ModelagemLivreProps): ReactNode => {
  const editavel = useDocumentoEditavel(DOCUMENTO_VAZIO)
  const sqlDoModelo = useMemo(() => gerarSql(editavel.documento.logico ?? LOGICO_VAZIO), [editavel.documento.logico])

  return (
    <div className="flex h-[70vh] flex-col gap-2">
      <div className="min-h-0 flex-1">
        <EditorModelagem
          editavel={editavel}
          modo="conceitual_logico"
          barraDireita={
            <Button
              variant="ghost"
              disabled={sqlDoModelo.sql.trim() === ''}
              onClick={() => {
                onUsarSql(sqlDoModelo.sql)
              }}
            >
              Usar no meu banco
            </Button>
          }
        />
      </div>
      <p className="text-xs text-neutral-600">
        Este rascunho não é salvo: ao recarregar a página ele começa em branco. Para trabalhar em algo que fica
        guardado, use um exercício.
      </p>
    </div>
  )
}

export default ModelagemLivre
