import type { ReactNode } from 'react'
import type { ExercicioProfessor } from '~features/exercicio/types'
import type { DificuldadeExercicio } from '../types'

interface ExerciciosDificeisProps {
  exercicios: ExercicioProfessor[]
  dificuldade: DificuldadeExercicio[]
}

function porcentagem(valor: number | null): string {
  return valor === null ? 'sem dados' : `${Math.round(valor * 100)}%`
}

function media(valor: number | null): string {
  return valor === null ? 'sem dados' : valor.toFixed(1)
}

/**
 * Ordenado do mais difícil para o mais fácil. Exercício que ninguém tentou vai para o
 * fim: "sem dados" não é o mesmo que "0% de acerto" (Fase 9, etapa 5).
 */
export const ExerciciosDificeis = ({ exercicios, dificuldade }: ExerciciosDificeisProps): ReactNode => {
  const titulos = new Map(exercicios.map((exercicio) => [exercicio.id, exercicio.titulo]))
  const ordenados = [...dificuldade].sort((a, b) => (a.taxaAcerto ?? 2) - (b.taxaAcerto ?? 2))

  return (
    <section>
      <h2 className="text-base font-semibold text-neutral-900">Onde a turma trava</h2>
      <p className="mt-1 text-xs text-neutral-600">
        Calculado só entre os alunos que tentaram o exercício.
      </p>
      <table className="mt-2 min-w-full text-left text-sm">
        <thead>
          <tr className="text-xs text-neutral-600">
            <th scope="col" className="p-2 font-medium">Exercício</th>
            <th scope="col" className="p-2 font-medium">Acerto</th>
            <th scope="col" className="p-2 font-medium">Tentativas até enviar</th>
            <th scope="col" className="p-2 font-medium">Dicas por aluno</th>
          </tr>
        </thead>
        <tbody>
          {ordenados.map((item) => (
            <tr key={item.exercicioId} className="border-t border-neutral-100">
              <th scope="row" className="p-2 font-normal text-neutral-900">
                {titulos.get(item.exercicioId) ?? '—'}
              </th>
              <td className="p-2 text-neutral-700">{porcentagem(item.taxaAcerto)}</td>
              <td className="p-2 text-neutral-700">{media(item.mediaTentativas)}</td>
              <td className="p-2 text-neutral-700">{item.dicasPorAluno.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
