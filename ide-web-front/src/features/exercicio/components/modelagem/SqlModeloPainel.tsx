import { useState } from 'react'
import type { ReactNode } from 'react'
import type { SqlGerado } from '../../modelagem/gerarSql'

interface SqlModeloPainelProps {
  sql: SqlGerado
  tabelaDestacada: string | null
}

/**
 * "SQL do modelo": definição das tabelas (PostgreSQL) gerada ao vivo a partir do
 * modelo lógico. Só visualização — o sandbox usa o script de dados do professor.
 * Destaca o bloco da tabela selecionada (sincronização com a consulta).
 */
export const SqlModeloPainel = ({ sql, tabelaDestacada }: SqlModeloPainelProps): ReactNode => {
  const [copiado, setCopiado] = useState(false)
  const linhas = sql.sql ? sql.sql.split('\n') : []
  const bloco = sql.tabelas.find((tabela) => tabela.nome === tabelaDestacada)

  const copiar = (): void => {
    void navigator.clipboard.writeText(sql.sql).then(() => {
      setCopiado(true)
      setTimeout(() => { setCopiado(false) }, 2000)
    })
  }

  return (
    <details open className="group shrink-0 rounded-md border border-neutral-300 bg-white">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm font-medium text-neutral-900">
        <span>SQL do modelo</span>
        <span className="text-xs font-normal text-neutral-600">gerado automaticamente, não é executado</span>
        {sql.avisos.length > 0 ? (
          <span className="rounded-full bg-amber-100 px-2 text-xs font-medium text-amber-900">
            {sql.avisos.length} {sql.avisos.length === 1 ? 'aviso' : 'avisos'}
          </span>
        ) : null}
        {linhas.length > 0 ? (
          <button
            type="button"
            className="ml-auto text-xs font-medium text-primary-600 hover:underline"
            onClick={(evento) => {
              evento.preventDefault()
              copiar()
            }}
          >
            {copiado ? 'Copiado!' : 'Copiar'}
          </button>
        ) : null}
      </summary>
      <div className="flex flex-col gap-2 px-3 pb-2">
        {linhas.length === 0 ? (
          <p className="text-xs text-neutral-600">Adicione tabelas ao modelo para ver o SQL correspondente.</p>
        ) : (
          <pre aria-label="SQL gerado a partir do modelo" className="max-h-40 overflow-auto rounded bg-neutral-50 py-1 font-mono text-xs">
            {linhas.map((linha, indice) => {
              const numero = indice + 1
              const destacada = bloco !== undefined && numero >= bloco.linhaInicio && numero <= bloco.linhaFim
              return (
                <div key={numero} data-destacada={destacada || undefined} className={`px-2 ${destacada ? 'bg-primary-100' : ''}`}>
                  {linha || ' '}
                </div>
              )
            })}
          </pre>
        )}
        {sql.avisos.length > 0 ? (
          <ul aria-label="Avisos do modelo" className="flex max-h-24 flex-col gap-0.5 overflow-auto">
            {sql.avisos.map((aviso) => (
              <li key={aviso} className="text-xs text-amber-900">⚠ {aviso}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  )
}

export default SqlModeloPainel
