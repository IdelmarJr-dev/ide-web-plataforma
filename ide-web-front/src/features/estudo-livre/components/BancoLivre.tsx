import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '~components/Button/Button'
import { Modal } from '~components/Modal/Modal'
import { ResultadoSandbox } from '~features/exercicio/components/SandboxPainel'
import { estudoLivreService } from '../services/estudoLivreService'

interface BancoLivreProps {
  sql: string
  onSqlChange: (sql: string) => void
}

/**
 * Banco de estudo do aluno: um comando por vez, como no sandbox de exercício, mas aqui
 * ele pode criar as próprias tabelas — inclusive colando o DDL do modelo lógico que
 * desenhou ao lado.
 */
export const BancoLivre = ({ sql, onSqlChange }: BancoLivreProps): ReactNode => {
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false)

  const executarMutation = useMutation({
    mutationFn: () => estudoLivreService.executar(sql),
  })

  const limparMutation = useMutation({
    mutationFn: () => estudoLivreService.limparBanco(),
    onSuccess: () => {
      setConfirmandoLimpeza(false)
      executarMutation.reset()
    },
  })

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-900">
        Comando SQL
        <textarea
          value={sql}
          onChange={(event) => {
            onSqlChange(event.target.value)
          }}
          rows={8}
          spellCheck={false}
          className="rounded-md border border-neutral-300 p-2 font-mono text-sm text-neutral-800"
          placeholder={'CREATE TABLE aluno (id SERIAL PRIMARY KEY, nome TEXT NOT NULL);'}
        />
      </label>

      <p className="text-xs text-neutral-600">
        Um comando por vez — crie a tabela, depois insira, depois consulte. O banco é só seu e continua aqui quando
        você voltar.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          isLoading={executarMutation.isPending}
          loadingLabel="Executando…"
          disabled={sql.trim() === ''}
          aria-describedby={sql.trim() === '' ? 'motivo-executar-desabilitado' : undefined}
          onClick={() => {
            executarMutation.mutate()
          }}
        >
          Executar
        </Button>
        {/* Clicar num botão desabilitado parecia falha silenciosa: nada acontecia e nada
            era dito (relatório de testes 2026-09-16, Fase 9 D20). */}
        {sql.trim() === '' ? (
          <span id="motivo-executar-desabilitado" className="text-xs text-neutral-600">
            Escreva uma consulta para executar.
          </span>
        ) : null}
        <Button
          variant="ghost"
          onClick={() => {
            setConfirmandoLimpeza(true)
          }}
        >
          Limpar meu banco
        </Button>
      </div>

      {executarMutation.isError ? (
        <p role="alert" className="text-sm text-danger-500">
          {executarMutation.error.message}
        </p>
      ) : null}

      {executarMutation.data ? <ResultadoSandbox resultado={executarMutation.data} /> : null}

      <Modal
        title="Apagar tudo do seu banco?"
        isOpen={confirmandoLimpeza}
        onClose={() => {
          setConfirmandoLimpeza(false)
        }}
      >
        <p className="text-sm text-neutral-700">
          Todas as tabelas e dados que você criou no estudo livre serão apagados. Isso não afeta nenhum exercício de
          turma, e não dá pra desfazer.
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            isLoading={limparMutation.isPending}
            loadingLabel="Limpando…"
            onClick={() => {
              limparMutation.mutate()
            }}
          >
            Apagar
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setConfirmandoLimpeza(false)
            }}
          >
            Cancelar
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default BancoLivre
