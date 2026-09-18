import type { ReactNode } from 'react'
import { extrairPlano, TRADUCOES } from '../utils/planoExecucao'
import type { NoPlano } from '../utils/planoExecucao'

function descreverNo(no: NoPlano): string {
  const partes = [TRADUCOES[no.tipo] ?? no.tipo]
  if (no.tabela) partes.push(`tabela ${no.tabela}${no.alias && no.alias !== no.tabela ? ` (${no.alias})` : ''}`)
  if (no.indice) partes.push(`índice ${no.indice}`)
  if (no.linhasEstimadas !== null) partes.push(`~${String(no.linhasEstimadas)} linhas estimadas`)
  if (no.custoTotal !== null) partes.push(`custo ${no.custoTotal.toFixed(2)}`)
  return partes.join(' · ')
}

const ArvorePlano = ({ no }: { no: NoPlano }): ReactNode => (
  <li className="flex flex-col gap-1">
    <span className="text-xs text-neutral-800">{descreverNo(no)}</span>
    {no.filhos.length > 0 ? (
      <ul className="ml-4 flex flex-col gap-1 border-l border-neutral-300 pl-3">
        {no.filhos.map((filho, indice) => (
          <ArvorePlano key={`${filho.tipo}-${String(indice)}`} no={filho} />
        ))}
      </ul>
    ) : null}
  </li>
)

interface PlanoExecucaoProps {
  plano: unknown
}

/**
 * Plano de execução (EXPLAIN FORMAT JSON) mostrado de forma simplificada — recurso
 * opcional e didático do Nível Interno da arquitetura ANSI/SPARC (TCC, seção 5.1).
 */
export const PlanoExecucao = ({ plano }: PlanoExecucaoProps): ReactNode => {
  const raiz = extrairPlano(plano)
  if (!raiz) return null

  return (
    <details className="rounded-md border border-neutral-200 p-2">
      <summary className="cursor-pointer text-sm font-medium text-neutral-900">
        Ver como o PostgreSQL executa esta consulta
      </summary>
      <p className="mt-2 text-xs text-neutral-600">
        Plano de execução (EXPLAIN): o SGBD começa pelas etapas mais internas e sobe até o resultado. Custo e linhas são
        estimativas do PostgreSQL.
      </p>
      <ul aria-label="Plano de execução" className="mt-2 flex flex-col gap-1">
        <ArvorePlano no={raiz} />
      </ul>
    </details>
  )
}

export default PlanoExecucao
