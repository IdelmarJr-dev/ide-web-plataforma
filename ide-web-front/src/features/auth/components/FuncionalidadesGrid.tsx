import type { ReactNode } from 'react'

interface Funcionalidade {
  titulo: string
  descricao: string
}

const FUNCIONALIDADES: Funcionalidade[] = [
  {
    titulo: 'Turmas por código',
    descricao: 'Crie uma turma, compartilhe o código — alunos entram sem precisar de conta.',
  },
  {
    titulo: 'Exercícios combinados',
    descricao: 'SQL, diagrama MER e questão dissertativa no mesmo exercício, cada parte opcional.',
  },
  {
    titulo: 'Sandbox SQL isolado',
    descricao: 'Cada aluno testa e envia consultas num schema próprio, sem afetar os demais.',
  },
  {
    titulo: 'Diagrama MER interativo',
    descricao: 'Canvas de entidade-relacionamento com autosave, lado a lado com o editor SQL.',
  },
  {
    titulo: 'Correção e revisão',
    descricao: 'SQL corrigido automaticamente contra o gabarito; professor revisa e libera o resultado.',
  },
  {
    titulo: 'Dicas de IA',
    descricao: 'Sugestões pedagógicas sob demanda — nunca a resposta pronta.',
  },
]

export const FuncionalidadesGrid = (): ReactNode => {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="text-xl font-semibold text-neutral-900">O que já dá pra fazer</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FUNCIONALIDADES.map((item) => (
          <div key={item.titulo} className="rounded-md border border-neutral-200 p-4">
            <h3 className="text-sm font-semibold text-neutral-900">{item.titulo}</h3>
            <p className="mt-1 text-sm text-neutral-600">{item.descricao}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default FuncionalidadesGrid
