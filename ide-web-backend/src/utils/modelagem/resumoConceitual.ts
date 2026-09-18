import type { ElementoConceitual, ModeloConceitual } from '../../dtos/modelagem.schema';

/**
 * Resumo em texto do modelo conceitual do aluno, para a dica de IA (suposição 3 de
 * docs/decisions/fase7-modelagem-conceitual-logica.md): o lógico vai como DDL e o
 * conceitual como estas linhas — muito mais curtas e legíveis pro LLM que o JSON do canvas.
 * Sem dado de identificação do aluno: só o desenho.
 */

type Atributo = Extract<ElementoConceitual, { tipo: 'atributo' }>;

const SEM_NOME = '(sem nome)';

function nomeOu(nome: string, padrao = SEM_NOME): string {
  return nome.trim() === '' ? padrao : nome.trim();
}

function filhosDe(conceitual: ModeloConceitual, paiId: string): Atributo[] {
  return conceitual.elementos.filter((elemento): elemento is Atributo => elemento.tipo === 'atributo' && elemento.paiId === paiId);
}

function descreverAtributo(conceitual: ModeloConceitual, atributo: Atributo): string {
  const partes: string[] = [];
  if (atributo.chave) partes.push('identificador');
  if (atributo.cardinalidade === '(0,n)' || atributo.cardinalidade === '(1,n)') partes.push('multivalorado');

  const filhos = filhosDe(conceitual, atributo.id);
  if (filhos.length > 0) {
    partes.push(`composto por ${filhos.map((filho) => descreverAtributo(conceitual, filho)).join(', ')}`);
  }

  return partes.length > 0 ? `${nomeOu(atributo.nome)} [${partes.join('; ')}]` : nomeOu(atributo.nome);
}

function listarAtributos(conceitual: ModeloConceitual, paiId: string): string {
  const atributos = filhosDe(conceitual, paiId);
  if (atributos.length === 0) return 'sem atributos';
  return atributos.map((atributo) => descreverAtributo(conceitual, atributo)).join(', ');
}

/** `(mín,máx)` junto da entidade, na convenção de Heuser usada pelo editor. */
function descreverParticipacoes(conceitual: ModeloConceitual, relacionamentoId: string): string {
  const nomes = new Map(conceitual.elementos.map((elemento) => [elemento.id, elemento]));
  const pernas = conceitual.ligacoes
    .filter((ligacao) => ligacao.tipo === 'participacao' && ligacao.relacionamentoId === relacionamentoId)
    .map((ligacao) => {
      if (ligacao.tipo !== 'participacao') return '';
      const alvo = nomes.get(ligacao.entidadeId);
      const nome = alvo && 'nome' in alvo ? nomeOu(alvo.nome) : SEM_NOME;
      const papel = ligacao.papel.trim() === '' ? '' : ` como ${ligacao.papel.trim()}`;
      return `${nome} (${ligacao.min.toString()},${ligacao.max})${papel}`;
    });
  return pernas.length === 0 ? 'sem participantes' : pernas.join(' — ');
}

export function resumirConceitual(conceitual: ModeloConceitual): string {
  const linhas: string[] = [];

  for (const elemento of conceitual.elementos) {
    if (elemento.tipo === 'entidade') {
      linhas.push(`Entidade ${nomeOu(elemento.nome)}: ${listarAtributos(conceitual, elemento.id)}`);
    }
  }

  for (const elemento of conceitual.elementos) {
    if (elemento.tipo === 'relacionamento') {
      const tipo = elemento.associativa ? 'Relacionamento (entidade associativa)' : 'Relacionamento';
      linhas.push(
        `${tipo} ${nomeOu(elemento.nome)}: ${descreverParticipacoes(conceitual, elemento.id)}` +
          ` | atributos: ${listarAtributos(conceitual, elemento.id)}`,
      );
    }
  }

  for (const elemento of conceitual.elementos) {
    if (elemento.tipo === 'especializacao') {
      const nomes = new Map(conceitual.elementos.map((outro) => [outro.id, outro]));
      const generica = nomes.get(elemento.paiId);
      const filhas = conceitual.ligacoes
        .filter((ligacao) => ligacao.tipo === 'filho_especializacao' && ligacao.especializacaoId === elemento.id)
        .map((ligacao) => {
          const filha = ligacao.tipo === 'filho_especializacao' ? nomes.get(ligacao.entidadeId) : undefined;
          return filha && 'nome' in filha ? nomeOu(filha.nome) : SEM_NOME;
        });
      const generalizada = generica && 'nome' in generica ? nomeOu(generica.nome) : SEM_NOME;
      linhas.push(
        `Especialização de ${generalizada} em ${filhas.length === 0 ? '(sem entidades especializadas)' : filhas.join(', ')}` +
          ` (${elemento.total ? 'total' : 'parcial'}, ${elemento.disjunta ? 'disjunta' : 'sobreposta'})`,
      );
    }
  }

  return linhas.join('\n');
}
