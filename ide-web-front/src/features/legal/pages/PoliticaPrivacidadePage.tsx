import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export const PoliticaPrivacidadePage = (): ReactNode => {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link to="/login" className="text-sm font-medium text-primary-600 hover:underline">
        ← Voltar
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-neutral-900">Política de privacidade</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Rascunho — orienta o uso da ferramenta, mas não substitui aconselhamento jurídico formal. Última revisão:
        setembro de 2026.
      </p>

      <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed text-neutral-700">
        <section>
          <h2 className="text-base font-semibold text-neutral-900">1. Sobre este documento</h2>
          <p className="mt-2">
            A IDE Web é um projeto de pesquisa acadêmica (Trabalho de Conclusão de Curso) que também funciona como
            ferramenta real de ensino de banco de dados. Esta política descreve quais dados a ferramenta coleta, para
            que servem e onde ficam armazenados, em linha com os princípios da Lei Geral de Proteção de Dados
            (LGPD).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">2. Dados que coletamos</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <strong>Conta de professor/pesquisador:</strong> nome, e-mail e senha (armazenada com hash — nunca em
              texto puro).
            </li>
            <li>
              <strong>Sessão do aluno:</strong> nome e um código pessoal (também com hash) para continuar de outro
              computador. Aluno não cria conta com e-mail nem senha.
            </li>
            <li>
              <strong>Uso do produto:</strong> turmas, exercícios, consultas SQL enviadas, diagramas
              entidade-relacionamento e resultados/notas — necessários para o funcionamento da ferramenta.
            </li>
            <li>
              <strong>Dados de pesquisa</strong> (só quando o aluno participa da pesquisa do TCC, mediante
              consentimento — TCLE): grupo sorteado (controle ou experimental), respostas aos questionários SUS e
              NASA-RTLX e a duração da tarefa. Nenhum endereço IP é registrado.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">3. Onde os dados ficam armazenados</h2>
          <p className="mt-2">
            Os dados de uso do produto (contas, turmas, exercícios, diagramas, submissões) ficam num banco de dados
            gerenciado (Supabase). Os dados de pesquisa com seres humanos — consentimento (TCLE), grupo sorteado e
            respostas SUS/RTLX — nunca vão para esse serviço gerenciado: ficam num servidor próprio do autor da
            pesquisa, self-hosted, justamente para manter esse dado sensível fora de qualquer nuvem de terceiros. Para a
            análise estatística, os dados são exportados sem nome, com um código de participante (P01, P02…).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">4. Compartilhamento com terceiros</h2>
          <p className="mt-2">
            A funcionalidade de dicas de IA envia o enunciado do exercício e o estado atual da consulta/diagrama do
            aluno para um provedor de modelo de linguagem externo (Groq), apenas o necessário para montar a dica
            pedagógica — nunca nome, e-mail ou qualquer outro dado de identificação do aluno. Nenhum dado de
            pesquisa (TCLE, SUS, RTLX) é compartilhado com terceiros.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">5. Por quanto tempo guardamos</h2>
          <p className="mt-2">
            Dados de produto (contas, turmas, exercícios) permanecem enquanto a ferramenta estiver em uso pela
            instituição. Dados de pesquisa são mantidos pelo período da coleta do TCC e conforme exigido pelo
            protocolo de pesquisa aprovado; o código de sorteio de grupo e a coleta de pesquisa são removidos da
            ferramenta após o fim da coleta de dados.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">6. Seus direitos</h2>
          <p className="mt-2">
            Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento. Se você participa da
            pesquisa do TCC, pode revogar seu consentimento (TCLE) quando quiser, sem prejuízo ao uso da ferramenta
            como aluno.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">7. Contato</h2>
          <p className="mt-2">
            Dúvidas sobre esta política ou sobre seus dados podem ser encaminhadas ao responsável pelo projeto
            (professor/pesquisador da sua turma).
          </p>
        </section>
      </div>
    </div>
  )
}

export default PoliticaPrivacidadePage
