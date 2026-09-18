import type { ReactNode } from 'react'

// Versão 2.0 do termo — mesmo conteúdo do Apêndice A do TCC (tcc/latex_tcc/textual/apendice-a.tex)
// e da constante TCLE_VERSAO_ATUAL do backend de pesquisa. Mudou o texto? Mude os três.
// O contato do Comitê de Ética em Pesquisa (CEP) só existe depois da submissão — ele fica
// marcado abaixo até ser preenchido, e a coleta real não deve começar antes disso.
export const CONTATO_PESQUISADOR = 'capic.2024218tads0009@aluno.ifpi.edu.br'
export const CONTATO_CEP_PENDENTE = '[CONTATO DO CEP DO IFPI — preencher após a aprovação do projeto]'

export const TermoTexto = (): ReactNode => (
  <div className="flex flex-col gap-4 text-sm leading-relaxed text-neutral-700">
    <p>
      <strong>Título da pesquisa:</strong> IDE Web para o Ensino de Banco de Dados: unificação de MER e SQL com
      andaime computacional baseado em IA.
      <br />
      <strong>Pesquisador responsável:</strong> Idelmar Júnior de Matos Cunha (Tecnologia em Análise e
      Desenvolvimento de Sistemas — IFPI, Campus Picos), sob orientação do Prof. Me. João Paulo Lima do Nascimento.
    </p>

    <p>
      <strong>Objetivo:</strong> comparar, entre um grupo que utiliza ferramentas tradicionais fragmentadas e um grupo
      que utiliza a IDE Web integrada, a usabilidade e o esforço mental percebidos durante o aprendizado de modelagem
      e SQL.
    </p>

    <p>
      Você está sendo convidado(a) a participar voluntariamente desta pesquisa. Sua participação consiste em resolver
      tarefas de modelagem de dados e programação SQL utilizando o ambiente que lhe for designado por sorteio
      (ferramentas tradicionais ou IDE Web), sem que você escolha o grupo. Após as tarefas (até cerca de 60 minutos),
      você responderá a dois questionários sobre sua experiência de uso e seu esforço mental.
    </p>

    <p>
      <strong>Riscos e benefícios:</strong> não há riscos físicos previstos além de possíveis desconfortos ergonômicos
      típicos do uso de computadores ou cansaço mental temporário durante a resolução dos exercícios. O benefício é
      contribuir para o desenvolvimento de ferramentas educacionais mais eficientes para o seu curso.
    </p>

    <p>
      <strong>Confidencialidade:</strong> sua identidade será mantida em sigilo. Suas respostas ficam armazenadas
      separadamente da sua conta, num servidor próprio do pesquisador — nunca em serviços de nuvem de terceiros. Os
      dados são analisados sem nome, com um código de participante (P01, P02…), e publicados somente de forma agregada,
      para fins acadêmicos, sem possibilidade de identificação individual.
    </p>

    <p>
      <strong>Participação voluntária:</strong> você pode recusar ou desistir a qualquer momento, durante ou após as
      tarefas, sem nenhuma penalidade acadêmica, administrativa ou institucional. Se desistir depois de aceitar, suas
      respostas deixam de fazer parte da análise. Resolver os exercícios da disciplina continua funcionando normalmente
      mesmo sem aceitar este termo.
    </p>

    <p>
      <strong>Dúvidas e contato:</strong> {CONTATO_PESQUISADOR}. Comitê de Ética em Pesquisa: {CONTATO_CEP_PENDENTE}.
    </p>

    <p>
      Ao clicar em &quot;Li e aceito participar&quot;, você declara estar ciente dos objetivos, procedimentos, riscos e
      benefícios descritos acima e aceita participar voluntariamente. O aceite fica registrado eletronicamente, com a
      versão deste termo.
    </p>
  </div>
)

export default TermoTexto
