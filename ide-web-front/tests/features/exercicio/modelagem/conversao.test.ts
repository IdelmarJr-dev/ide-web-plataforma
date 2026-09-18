import { describe, expect, it } from 'vitest'
import type { ElementoConceitual, LigacaoConceitual, ModeloConceitual, ModeloLogico } from '../../../../src/features/exercicio/modelagem/documento'
import { problemasDoLogico } from '../../../../src/features/exercicio/modelagem/documento'
import {
  assinaturaConceitual,
  converter,
  identificarPendencias,
} from '../../../../src/features/exercicio/modelagem/conceitual/conversao'

const POSICAO = { x: 0, y: 0 }

function entidade(id: string, nome: string): ElementoConceitual {
  return { id, tipo: 'entidade', posicao: POSICAO, nome }
}

function relacionamento(id: string, nome: string): ElementoConceitual {
  return { id, tipo: 'relacionamento', posicao: POSICAO, nome, associativa: false }
}

function atributo(
  id: string,
  nome: string,
  paiId: string,
  mudancas: Partial<Extract<ElementoConceitual, { tipo: 'atributo' }>> = {},
): ElementoConceitual {
  return { id, tipo: 'atributo', posicao: POSICAO, nome, paiId, chave: false, cardinalidade: '(1,1)', tipoSugerido: null, ...mudancas }
}

function participacao(id: string, relacionamentoId: string, entidadeId: string, min: 0 | 1, max: '1' | 'n', papel = ''): LigacaoConceitual {
  return { id, tipo: 'participacao', relacionamentoId, entidadeId, min, max, papel }
}

function especializacao(id: string, paiId: string, total = false, disjunta = true): ElementoConceitual {
  return { id, tipo: 'especializacao', posicao: POSICAO, paiId, total, disjunta }
}

function filho(id: string, especializacaoId: string, entidadeId: string): LigacaoConceitual {
  return { id, tipo: 'filho_especializacao', especializacaoId, entidadeId }
}

function modelo(elementos: ElementoConceitual[], ligacoes: LigacaoConceitual[] = []): ModeloConceitual {
  return { elementos, ligacoes, visaoAtributos: 'circulos' }
}

function tabela(logico: ModeloLogico, id: string): ModeloLogico['tabelas'][number] | undefined {
  return logico.tabelas.find((existente) => existente.id === id)
}

function nomesDasColunas(logico: ModeloLogico, tabelaId: string): string[] {
  return tabela(logico, tabelaId)?.colunas.map((coluna) => coluna.nome) ?? []
}

/** cliente (1,1) —faz— (0,n) pedido: cada pedido tem 1 cliente, cada cliente tem 0..n pedidos. */
function clienteFazPedido(minCliente: 0 | 1 = 1): ModeloConceitual {
  return modelo(
    [
      entidade('e-cliente', 'cliente'),
      atributo('a-cliente-id', 'codigo', 'e-cliente', { chave: true }),
      entidade('e-pedido', 'pedido'),
      atributo('a-pedido-id', 'numero', 'e-pedido', { chave: true }),
      relacionamento('r-faz', 'faz'),
    ],
    [
      participacao('p-1', 'r-faz', 'e-cliente', minCliente, '1'),
      participacao('p-2', 'r-faz', 'e-pedido', 0, 'n'),
    ],
  )
}

describe('conversão conceitual → lógico', () => {
  it('entidade vira tabela: identificador é PK, cardinalidade do atributo define NOT NULL, tipo sugerido é respeitado', () => {
    const conceitual = modelo([
      entidade('e1', 'cliente'),
      atributo('a1', 'codigo', 'e1', { chave: true }),
      atributo('a2', 'nome', 'e1', { tipoSugerido: { tipo: 'VARCHAR', tamanho: 120, escala: null } }),
      atributo('a3', 'apelido', 'e1', { cardinalidade: '(0,1)' }),
    ])
    const { logico, avisos } = converter(conceitual)

    expect(tabela(logico, 'e1')?.nome).toBe('cliente')
    expect(tabela(logico, 'e1')?.colunas).toMatchObject([
      { id: 'a1', nome: 'codigo', tipo: 'INTEGER', pk: true, notNull: true },
      { id: 'a2', nome: 'nome', tipo: 'VARCHAR', tamanho: 120, pk: false, notNull: true },
      { id: 'a3', nome: 'apelido', pk: false, notNull: false },
    ])
    expect(avisos).toEqual([])
    expect(problemasDoLogico(logico)).toEqual([])
  })

  it('entidade sem identificador ganha chave substituta e avisa', () => {
    const { logico, avisos } = converter(modelo([entidade('e1', 'cliente'), atributo('a1', 'nome', 'e1')]))

    expect(tabela(logico, 'e1')?.colunas[0]).toMatchObject({ nome: 'id', tipo: 'INTEGER', pk: true, autoIncremento: true })
    expect(avisos[0]).toContain('não tem atributo identificador')
  })

  it('1:N põe a FK no lado N, NOT NULL quando o mínimo do lado 1 é 1', () => {
    const obrigatorio = converter(clienteFazPedido(1)).logico
    expect(tabela(obrigatorio, 'e-pedido')?.colunas[1]).toMatchObject({
      nome: 'cliente_codigo',
      notNull: true,
      unique: false,
      fk: { tabelaId: 'e-cliente', colunaId: 'a-cliente-id' },
    })
    expect(nomesDasColunas(obrigatorio, 'e-cliente')).toEqual(['codigo'])
    expect(problemasDoLogico(obrigatorio)).toEqual([])

    const opcional = converter(clienteFazPedido(0)).logico
    expect(tabela(opcional, 'e-pedido')?.colunas[1]).toMatchObject({ notNull: false })
  })

  it('atributo do relacionamento 1:N acompanha a tabela que recebeu a FK', () => {
    const conceitual = clienteFazPedido()
    conceitual.elementos.push(atributo('a-data', 'data_do_pedido', 'r-faz', { cardinalidade: '(0,1)' }))
    const { logico } = converter(conceitual)

    expect(nomesDasColunas(logico, 'e-pedido')).toEqual(['numero', 'cliente_codigo', 'data_do_pedido'])
  })

  it('N:N vira tabela do relacionamento com PK composta pelas FKs e atributos próprios', () => {
    const conceitual = modelo(
      [
        entidade('e-aluno', 'aluno'),
        atributo('a-aluno', 'matricula', 'e-aluno', { chave: true }),
        entidade('e-disciplina', 'disciplina'),
        atributo('a-disciplina', 'codigo', 'e-disciplina', { chave: true }),
        relacionamento('r-cursa', 'cursa'),
        atributo('a-nota', 'nota', 'r-cursa', { cardinalidade: '(0,1)' }),
      ],
      [participacao('p1', 'r-cursa', 'e-aluno', 0, 'n'), participacao('p2', 'r-cursa', 'e-disciplina', 0, 'n')],
    )
    const { logico } = converter(conceitual)

    expect(tabela(logico, 'r-cursa')?.colunas).toMatchObject([
      { nome: 'aluno_matricula', pk: true, notNull: true, fk: { tabelaId: 'e-aluno', colunaId: 'a-aluno' } },
      { nome: 'disciplina_codigo', pk: true, notNull: true, fk: { tabelaId: 'e-disciplina', colunaId: 'a-disciplina' } },
      { nome: 'nota', pk: false },
    ])
    expect(problemasDoLogico(logico)).toEqual([])
  })

  it('n-ário gera uma tabela com uma FK por perna; só as pernas de máximo n entram na PK', () => {
    const conceitual = modelo(
      [
        entidade('e-a', 'medico'),
        atributo('a-a', 'crm', 'e-a', { chave: true }),
        entidade('e-b', 'paciente'),
        atributo('a-b', 'cpf', 'e-b', { chave: true }),
        entidade('e-c', 'sala'),
        atributo('a-c', 'numero', 'e-c', { chave: true }),
        relacionamento('r', 'consulta'),
      ],
      [
        participacao('p1', 'r', 'e-a', 0, 'n'),
        participacao('p2', 'r', 'e-b', 0, 'n'),
        participacao('p3', 'r', 'e-c', 0, '1'),
      ],
    )
    const { logico } = converter(conceitual)
    const colunas = tabela(logico, 'r')?.colunas ?? []

    expect(colunas.map((coluna) => coluna.nome)).toEqual(['medico_crm', 'paciente_cpf', 'sala_numero'])
    expect(colunas.filter((coluna) => coluna.pk).map((coluna) => coluna.nome)).toEqual(['medico_crm', 'paciente_cpf'])
  })

  it('auto-relacionamento usa o papel para nomear a FK', () => {
    const conceitual = modelo(
      [entidade('e', 'funcionario'), atributo('a', 'matricula', 'e', { chave: true }), relacionamento('r', 'supervisiona')],
      [
        participacao('p1', 'r', 'e', 0, '1', 'supervisor'),
        participacao('p2', 'r', 'e', 0, 'n', 'subordinado'),
      ],
    )
    const { logico } = converter(conceitual)

    expect(nomesDasColunas(logico, 'e')).toEqual(['matricula', 'supervisor_matricula'])
    expect(tabela(logico, 'e')?.colunas[1]).toMatchObject({ fk: { tabelaId: 'e', colunaId: 'a' }, notNull: false })
    expect(problemasDoLogico(logico)).toEqual([])
  })

  it('1:1 com FK no lado obrigatório: a FK fica na entidade de participação total e é única', () => {
    // cliente (0,1) —tem— (1,1) endereço: todo endereço é de um cliente; cliente pode não ter endereço.
    const conceitual = modelo(
      [
        entidade('e-cliente', 'cliente'),
        atributo('a-cliente', 'codigo', 'e-cliente', { chave: true }),
        entidade('e-endereco', 'endereco'),
        atributo('a-endereco', 'id', 'e-endereco', { chave: true }),
        relacionamento('r', 'tem'),
      ],
      [
        participacao('p1', 'r', 'e-cliente', 1, '1'),
        participacao('p2', 'r', 'e-endereco', 0, '1'),
      ],
    )
    const { logico } = converter(conceitual, { r: 'fk_lado_total' })

    // mínimo do lado cliente = 1 → todo endereço tem cliente → FK obrigatória e única em endereco.
    expect(nomesDasColunas(logico, 'e-endereco')).toEqual(['id', 'cliente_codigo'])
    expect(tabela(logico, 'e-endereco')?.colunas[1]).toMatchObject({ unique: true, notNull: true })
    expect(nomesDasColunas(logico, 'e-cliente')).toEqual(['codigo'])
    expect(problemasDoLogico(logico)).toEqual([])
  })

  it('1:1 com "fundir" junta as duas entidades numa tabela só', () => {
    const conceitual = modelo(
      [
        entidade('e-a', 'usuario'),
        atributo('a-a', 'login', 'e-a', { chave: true }),
        entidade('e-b', 'perfil'),
        atributo('a-b', 'id', 'e-b', { chave: true }),
        atributo('a-b2', 'bio', 'e-b', { cardinalidade: '(0,1)' }),
        relacionamento('r', 'possui'),
      ],
      [participacao('p1', 'r', 'e-a', 1, '1'), participacao('p2', 'r', 'e-b', 1, '1')],
    )
    const { logico, avisos, origem } = converter(conceitual, { r: 'fundir' })

    expect(logico.tabelas.map((t) => t.id)).toEqual(['e-a'])
    expect(tabela(logico, 'e-a')?.colunas).toMatchObject([
      { nome: 'login', pk: true },
      { nome: 'id', pk: false, unique: true, notNull: true },
      { nome: 'bio', pk: false },
    ])
    expect(origem.tabelaPorElemento['e-b']).toBe('e-a')
    expect(avisos.some((aviso) => aviso.includes('fundidas'))).toBe(true)
    expect(problemasDoLogico(logico)).toEqual([])
  })

  it('1:1 com "tabela própria" cria a terceira tabela com as duas FKs únicas', () => {
    const conceitual = modelo(
      [
        entidade('e-a', 'usuario'),
        atributo('a-a', 'login', 'e-a', { chave: true }),
        entidade('e-b', 'cracha'),
        atributo('a-b', 'id', 'e-b', { chave: true }),
        relacionamento('r', 'usa'),
      ],
      [participacao('p1', 'r', 'e-a', 0, '1'), participacao('p2', 'r', 'e-b', 0, '1')],
    )
    const { logico } = converter(conceitual, { r: 'tabela_propria' })

    expect(logico.tabelas.map((t) => t.id).sort()).toEqual(['e-a', 'e-b', 'r'])
    expect(tabela(logico, 'r')?.colunas).toMatchObject([
      { nome: 'usuario_login', pk: true, unique: true, notNull: true },
      { nome: 'cracha_id', pk: false, unique: true, notNull: true },
    ])
    expect(problemasDoLogico(logico)).toEqual([])
  })

  it('pendências listam só os 1:1, com "fundir" disponível apenas quando as duas participações são obrigatórias', () => {
    const opcional = modelo(
      [entidade('e-a', 'a'), atributo('a-a', 'id', 'e-a', { chave: true }), entidade('e-b', 'b'), atributo('a-b', 'id', 'e-b', { chave: true }), relacionamento('r', 'liga')],
      [participacao('p1', 'r', 'e-a', 0, '1'), participacao('p2', 'r', 'e-b', 1, '1')],
    )
    const [pendencia] = identificarPendencias(opcional)
    expect(pendencia).toMatchObject({ elementoId: 'r', tipo: 'um_para_um', escolhaAtual: 'fk_lado_total' })
    expect(pendencia?.opcoes).toEqual(['fk_lado_total', 'tabela_propria'])
    expect(pendencia?.rotulo).toBe('liga — a / b')

    const total = modelo(opcional.elementos, [
      participacao('p1', 'r', 'e-a', 1, '1'),
      participacao('p2', 'r', 'e-b', 1, '1'),
    ])
    expect(identificarPendencias(total, { r: 'fundir' })[0]).toMatchObject({
      opcoes: ['fk_lado_total', 'fundir', 'tabela_propria'],
      escolhaAtual: 'fundir',
    })

    // 1:N não gera pergunta.
    expect(identificarPendencias(clienteFazPedido())).toEqual([])
  })

  it('relacionamento sem as duas pontas vira aviso, não quebra a conversão', () => {
    const conceitual = modelo(
      [entidade('e', 'cliente'), atributo('a', 'id', 'e', { chave: true }), relacionamento('r', 'solto')],
      [participacao('p1', 'r', 'e', 0, 'n')],
    )
    const { logico, avisos } = converter(conceitual)

    expect(logico.tabelas.map((t) => t.id)).toEqual(['e'])
    expect(avisos[0]).toContain('precisa de duas entidades ligadas')
  })

  it('atributo composto vira colunas achatadas com o nome do pai na frente', () => {
    const conceitual = modelo([
      entidade('e', 'cliente'),
      atributo('a-id', 'codigo', 'e', { chave: true }),
      atributo('a-end', 'endereco', 'e'),
      atributo('a-rua', 'rua', 'a-end'),
      atributo('a-num', 'numero', 'a-end', { cardinalidade: '(0,1)' }),
    ])
    const { logico } = converter(conceitual)

    expect(nomesDasColunas(logico, 'e')).toEqual(['codigo', 'endereco_rua', 'endereco_numero'])
    expect(tabela(logico, 'e')?.colunas[2]).toMatchObject({ notNull: false })
    expect(problemasDoLogico(logico)).toEqual([])
  })

  it('identificador composto marca as folhas como chave primária', () => {
    const conceitual = modelo([
      entidade('e', 'aula'),
      atributo('a-chave', 'quando', 'e', { chave: true }),
      atributo('a-dia', 'dia', 'a-chave'),
      atributo('a-hora', 'hora', 'a-chave'),
    ])
    const { logico } = converter(conceitual)

    expect(tabela(logico, 'e')?.colunas).toMatchObject([
      { nome: 'quando_dia', pk: true, notNull: true },
      { nome: 'quando_hora', pk: true, notNull: true },
    ])
  })

  it('atributo multivalorado vira tabela própria com a chave do dono', () => {
    const conceitual = modelo([
      entidade('e', 'cliente'),
      atributo('a-id', 'codigo', 'e', { chave: true }),
      atributo('a-tel', 'telefone', 'e', { cardinalidade: '(1,n)' }),
    ])
    const { logico, origem } = converter(conceitual)

    expect(nomesDasColunas(logico, 'e')).toEqual(['codigo'])
    const tabelaTelefone = tabela(logico, origem.tabelaPorElemento['a-tel'] ?? '')
    expect(tabelaTelefone?.nome).toBe('cliente_telefone')
    expect(tabelaTelefone?.colunas).toMatchObject([
      { nome: 'cliente_codigo', pk: true, notNull: true, fk: { tabelaId: 'e', colunaId: 'a-id' } },
      { nome: 'telefone', pk: true, notNull: true },
    ])
    expect(problemasDoLogico(logico)).toEqual([])
  })

  it('especialização padrão: cada especializada herda a chave da genérica como PK', () => {
    const conceitual = modelo(
      [
        entidade('e-pessoa', 'pessoa'),
        atributo('a-cpf', 'cpf', 'e-pessoa', { chave: true }),
        entidade('e-aluno', 'aluno'),
        atributo('a-matricula', 'matricula', 'e-aluno'),
        entidade('e-professor', 'professor'),
        especializacao('esp', 'e-pessoa'),
      ],
      [filho('f1', 'esp', 'e-aluno'), filho('f2', 'esp', 'e-professor')],
    )
    const { logico, avisos } = converter(conceitual)

    expect(logico.tabelas.map((t) => t.id).sort()).toEqual(['e-aluno', 'e-pessoa', 'e-professor'])
    expect(tabela(logico, 'e-aluno')?.colunas).toMatchObject([
      { nome: 'pessoa_cpf', pk: true, notNull: true, fk: { tabelaId: 'e-pessoa', colunaId: 'a-cpf' } },
      { nome: 'matricula', pk: false },
    ])
    // Especializada não ganha chave substituta: ela herda a da genérica.
    expect(avisos.some((aviso) => aviso.includes('não tem atributo identificador'))).toBe(false)
    expect(problemasDoLogico(logico)).toEqual([])
  })

  it('especialização em tabela única junta tudo com coluna "tipo" e colunas opcionais', () => {
    const conceitual = modelo(
      [
        entidade('e-pessoa', 'pessoa'),
        atributo('a-cpf', 'cpf', 'e-pessoa', { chave: true }),
        entidade('e-aluno', 'aluno'),
        atributo('a-matricula', 'matricula', 'e-aluno'),
        especializacao('esp', 'e-pessoa', true),
      ],
      [filho('f1', 'esp', 'e-aluno')],
    )
    const { logico, origem } = converter(conceitual, { esp: 'tabela_unica' })

    expect(logico.tabelas.map((t) => t.id)).toEqual(['e-pessoa'])
    expect(tabela(logico, 'e-pessoa')?.colunas).toMatchObject([
      { nome: 'cpf', pk: true },
      { nome: 'matricula', pk: false, notNull: false },
      { nome: 'tipo', notNull: true },
    ])
    expect(origem.tabelaPorElemento['e-aluno']).toBe('e-pessoa')
    expect(problemasDoLogico(logico)).toEqual([])
  })

  it('especialização total pode dispensar a tabela da genérica; parcial não oferece a opção', () => {
    const elementos = [
      entidade('e-pessoa', 'pessoa'),
      atributo('a-cpf', 'cpf', 'e-pessoa', { chave: true }),
      entidade('e-aluno', 'aluno'),
      atributo('a-matricula', 'matricula', 'e-aluno'),
    ]
    const ligacoes = [filho('f1', 'esp', 'e-aluno')]

    const total = modelo([...elementos, especializacao('esp', 'e-pessoa', true)], ligacoes)
    const { logico } = converter(total, { esp: 'so_especializadas' })
    expect(logico.tabelas.map((t) => t.id)).toEqual(['e-aluno'])
    expect(nomesDasColunas(logico, 'e-aluno')).toEqual(['cpf', 'matricula'])
    expect(problemasDoLogico(logico)).toEqual([])

    const parcial = modelo([...elementos, especializacao('esp', 'e-pessoa', false)], ligacoes)
    const pendencia = identificarPendencias(parcial).find((p) => p.tipo === 'especializacao')
    expect(pendencia?.opcoes).toEqual(['tabela_por_entidade', 'tabela_unica'])
    // Escolha inválida cai no padrão, com aviso.
    const caiuNoPadrao = converter(parcial, { esp: 'so_especializadas' })
    expect(caiuNoPadrao.logico.tabelas.map((t) => t.id).sort()).toEqual(['e-aluno', 'e-pessoa'])
    expect(caiuNoPadrao.avisos.some((aviso) => aviso.includes('especialização é total'))).toBe(true)
  })

  it('entidade associativa vira tabela e pode ser referenciada por outro relacionamento', () => {
    const conceitual = modelo(
      [
        entidade('e-medico', 'medico'),
        atributo('a-crm', 'crm', 'e-medico', { chave: true }),
        entidade('e-paciente', 'paciente'),
        atributo('a-cpf', 'cpf', 'e-paciente', { chave: true }),
        { id: 'r-consulta', tipo: 'relacionamento', posicao: POSICAO, nome: 'consulta', associativa: true },
        entidade('e-receita', 'receita'),
        atributo('a-receita', 'numero', 'e-receita', { chave: true }),
        relacionamento('r-gera', 'gera'),
      ],
      [
        participacao('p1', 'r-consulta', 'e-medico', 0, 'n'),
        participacao('p2', 'r-consulta', 'e-paciente', 0, 'n'),
        // A associativa participa como se fosse entidade.
        participacao('p3', 'r-gera', 'r-consulta', 0, '1'),
        participacao('p4', 'r-gera', 'e-receita', 0, 'n'),
      ],
    )
    const { logico } = converter(conceitual)

    expect(tabela(logico, 'r-consulta')?.colunas).toMatchObject([
      { nome: 'medico_crm', pk: true },
      { nome: 'paciente_cpf', pk: true },
    ])
    // A receita (lado N) recebe a FK composta da consulta.
    expect(nomesDasColunas(logico, 'e-receita')).toEqual(['numero', 'consulta_medico_crm', 'consulta_paciente_cpf'])
    expect(problemasDoLogico(logico)).toEqual([])
  })

  it('assinatura ignora posição e nota, mas muda com a estrutura', () => {
    const base = clienteFazPedido()
    const assinatura = assinaturaConceitual(base)

    const movido = modelo(
      base.elementos.map((elemento) => ({ ...elemento, posicao: { x: 999, y: 999 } })),
      base.ligacoes,
    )
    expect(assinaturaConceitual(movido)).toBe(assinatura)

    const comNota = modelo([...base.elementos, { id: 'n1', tipo: 'nota', posicao: POSICAO, texto: 'lembrete' }], base.ligacoes)
    expect(assinaturaConceitual(comNota)).toBe(assinatura)

    const renomeado = modelo(
      base.elementos.map((elemento) => (elemento.id === 'e-cliente' ? { ...elemento, nome: 'freguês' } : elemento)),
      base.ligacoes,
    )
    expect(assinaturaConceitual(renomeado)).not.toBe(assinatura)

    const outraCardinalidade = modelo(base.elementos, [
      participacao('p-1', 'r-faz', 'e-cliente', 0, '1'),
      participacao('p-2', 'r-faz', 'e-pedido', 0, 'n'),
    ])
    expect(assinaturaConceitual(outraCardinalidade)).not.toBe(assinatura)
  })
})
