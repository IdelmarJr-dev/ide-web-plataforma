import type { ChangeEvent, ReactNode } from 'react'
import { ROTULO_TURNO } from '~features/turmas/types'
import type { FiltroTurmasValor } from '../filtroTurmas'
import type { TurmaDoPainel } from '../types'

interface FiltroTurmasProps {
  turmas: TurmaDoPainel[]
  valor: FiltroTurmasValor
  onChange: (valor: FiltroTurmasValor) => void
}

const CAMPO = 'rounded-md border border-neutral-300 p-2 text-sm'

export const FiltroTurmas = ({ turmas, valor, onChange }: FiltroTurmasProps): ReactNode => {
  // As opções saem das turmas que existem: filtrar por sala inexistente não faz sentido.
  const turnos = [...new Set(turmas.flatMap((turma) => (turma.turno === null ? [] : [turma.turno])))]
  const salas = [...new Set(turmas.flatMap((turma) => (turma.sala === null ? [] : [turma.sala])))].sort()

  if (turmas.length < 2) {
    return null
  }

  return (
    <section aria-label="Filtrar turmas" className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-turma" className="text-xs font-medium text-neutral-700">
          Turma
        </label>
        <select
          id="filtro-turma"
          className={CAMPO}
          value={valor.turmaId}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            onChange({ ...valor, turmaId: event.target.value })
          }}
        >
          <option value="">Todas</option>
          {turmas.map((turma) => (
            <option key={turma.id} value={turma.id}>
              {turma.nome}
            </option>
          ))}
        </select>
      </div>

      {turnos.length === 0 ? null : (
        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-turno" className="text-xs font-medium text-neutral-700">
            Turno
          </label>
          <select
            id="filtro-turno"
            className={CAMPO}
            value={valor.turno}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              onChange({ ...valor, turno: event.target.value })
            }}
          >
            <option value="">Todos</option>
            {turnos.map((turno) => (
              <option key={turno} value={turno}>
                {ROTULO_TURNO[turno]}
              </option>
            ))}
          </select>
        </div>
      )}

      {salas.length === 0 ? null : (
        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-sala" className="text-xs font-medium text-neutral-700">
            Sala
          </label>
          <select
            id="filtro-sala"
            className={CAMPO}
            value={valor.sala}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              onChange({ ...valor, sala: event.target.value })
            }}
          >
            <option value="">Todas</option>
            {salas.map((sala) => (
              <option key={sala} value={sala}>
                {sala}
              </option>
            ))}
          </select>
        </div>
      )}
    </section>
  )
}
