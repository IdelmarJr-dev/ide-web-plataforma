import { describe, expect, it } from 'vitest'
import type { ModeloConceitual } from '../../../../src/features/exercicio/modelagem/documento'
import { problemasDoConceitual } from '../../../../src/features/exercicio/modelagem/documento'
import {
  adicionarAtributo,
  adicionarEntidade,
  adicionarEspecializacao,
  adicionarNota,
  adicionarRelacionamento,
  atributosDe,
  atualizarAtributo,
  atualizarEspecializacao,
  atualizarParticipacao,
  atualizarTextoNota,
  criarFilhoEspecializacao,
  definirAssociativa,
  especializacoesDe,
  filhosDaEspecializacao,
  criarParticipacao,
  duplicarEntidade,
  moverElemento,
  participacoesDe,
  removerElemento,
  removerLigacao,
  renomearElemento,
} from '../../../../src/features/exercicio/modelagem/conceitual/operacoes'

function vazio(): ModeloConceitual {
  return { elementos: [], ligacoes: [], visaoAtributos: 'circulos' }
}

describe('operações do modelo conceitual', () => {
  it('nova entidade e novo relacionamento nascem com nome único incremental', () => {
    const { conceitual: c1, id: e1 } = adicionarEntidade(vazio(), { x: 0, y: 0 })
    const { conceitual: c2 } = adicionarEntidade(c1, { x: 10, y: 10 })
    const { conceitual: c3, id: r1 } = adicionarRelacionamento(c2, { x: 20, y: 20 })

    expect(c2.elementos.find((e) => e.id === e1)).toMatchObject({ nome: 'entidade1' })
    expect(c2.elementos[1]).toMatchObject({ nome: 'entidade2' })
    expect(c3.elementos.find((e) => e.id === r1)).toMatchObject({ tipo: 'relacionamento', nome: 'relacionamento1', associativa: false })
  })

  it('atributo só nasce sobre entidade ou relacionamento, com nome único', () => {
    const { conceitual: c1, id: entidadeId } = adicionarEntidade(vazio(), { x: 0, y: 0 })
    const { conceitual: c2, id: notaId } = adicionarNota(c1, { x: 5, y: 5 })

    const primeiro = adicionarAtributo(c2, entidadeId, { x: 1, y: 1 })
    expect(primeiro).not.toBeNull()
    const segundo = primeiro ? adicionarAtributo(primeiro.conceitual, entidadeId, { x: 2, y: 2 }) : null

    expect(segundo && atributosDe(segundo.conceitual, entidadeId).map((a) => a.nome)).toEqual(['atributo1', 'atributo2'])
    expect(adicionarAtributo(c2, notaId, { x: 1, y: 1 })).toBeNull()
    expect(adicionarAtributo(c2, 'inexistente', { x: 1, y: 1 })).toBeNull()
  })

  it('renomeia entidade, relacionamento e atributo; não afeta nota (usa atualizarTextoNota)', () => {
    const { conceitual: c1, id: entidadeId } = adicionarEntidade(vazio(), { x: 0, y: 0 })
    const { conceitual: c2, id: notaId } = adicionarNota(c1, { x: 0, y: 0 })

    const renomeado = renomearElemento(c2, entidadeId, 'cliente')
    expect(renomeado.elementos.find((e) => e.id === entidadeId)).toMatchObject({ nome: 'cliente' })

    const semEfeito = renomearElemento(renomeado, notaId, 'ignorado')
    expect(semEfeito.elementos.find((e) => e.id === notaId)).toMatchObject({ texto: '' })

    const comTexto = atualizarTextoNota(semEfeito, notaId, 'lembrete')
    expect(comTexto.elementos.find((e) => e.id === notaId)).toMatchObject({ texto: 'lembrete' })
  })

  it('move qualquer elemento pela posição', () => {
    const { conceitual, id } = adicionarEntidade(vazio(), { x: 0, y: 0 })
    const movido = moverElemento(conceitual, id, { x: 40, y: 55 })
    expect(movido.elementos.find((e) => e.id === id)).toMatchObject({ posicao: { x: 40, y: 55 } })
  })

  it('atualiza chave, cardinalidade e tipo sugerido do atributo', () => {
    const { conceitual: c1, id: entidadeId } = adicionarEntidade(vazio(), { x: 0, y: 0 })
    const { conceitual: c2, id: atributoId } = adicionarAtributo(c1, entidadeId, { x: 0, y: 0 }) ?? { conceitual: c1, id: '' }

    const atualizado = atualizarAtributo(c2, atributoId, {
      chave: true,
      cardinalidade: '(1,1)',
      tipoSugerido: { tipo: 'VARCHAR', tamanho: 60, escala: null },
    })

    expect(atualizado.elementos.find((e) => e.id === atributoId)).toMatchObject({
      chave: true,
      cardinalidade: '(1,1)',
      tipoSugerido: { tipo: 'VARCHAR', tamanho: 60, escala: null },
    })
  })

  it('cria participação entre relacionamento e entidade; recusa entidade-entidade e relacionamento-relacionamento', () => {
    const { conceitual: c1, id: clienteId } = adicionarEntidade(vazio(), { x: 0, y: 0 })
    const { conceitual: c2, id: pedidoId } = adicionarEntidade(c1, { x: 100, y: 0 })
    const { conceitual: c3, id: fazId } = adicionarRelacionamento(c2, { x: 50, y: 50 })

    const ok = criarParticipacao(c3, fazId, clienteId)
    expect(ok.ok).toBe(true)
    if (!ok.ok) return
    expect(participacoesDe(ok.conceitual, fazId)).toMatchObject([{ relacionamentoId: fazId, entidadeId: clienteId, min: 0, max: 'n', papel: '' }])
    expect(problemasDoConceitual(ok.conceitual)).toEqual([])

    expect(criarParticipacao(c3, clienteId, pedidoId)).toEqual({ ok: false, erro: 'Ligue um relacionamento a uma entidade.' })
    const { conceitual: c4, id: outroRel } = adicionarRelacionamento(c3, { x: 0, y: 50 })
    expect(criarParticipacao(c4, fazId, outroRel)).toEqual({ ok: false, erro: 'Ligue um relacionamento a uma entidade.' })
  })

  it('atualiza e remove participação', () => {
    const { conceitual: c1, id: clienteId } = adicionarEntidade(vazio(), { x: 0, y: 0 })
    const { conceitual: c2, id: fazId } = adicionarRelacionamento(c1, { x: 50, y: 50 })
    const ligado = criarParticipacao(c2, fazId, clienteId)
    if (!ligado.ok) throw new Error('deveria ligar')
    const [participacao] = participacoesDe(ligado.conceitual, fazId)
    if (!participacao) throw new Error('deveria ter participação')

    const atualizado = atualizarParticipacao(ligado.conceitual, participacao.id, { min: 1, max: '1', papel: 'titular' })
    expect(atualizado.ligacoes[0]).toMatchObject({ min: 1, max: '1', papel: 'titular' })

    const removido = removerLigacao(atualizado, participacao.id)
    expect(removido.ligacoes).toEqual([])
  })

  it('remover entidade ou relacionamento arrasta atributos e participações (cascata)', () => {
    const { conceitual: c1, id: clienteId } = adicionarEntidade(vazio(), { x: 0, y: 0 })
    const { conceitual: c2, id: atributoId } = adicionarAtributo(c1, clienteId, { x: 0, y: 0 }) ?? { conceitual: c1, id: '' }
    const { conceitual: c3, id: fazId } = adicionarRelacionamento(c2, { x: 50, y: 50 })
    const ligado = criarParticipacao(c3, fazId, clienteId)
    if (!ligado.ok) throw new Error('deveria ligar')

    const semCliente = removerElemento(ligado.conceitual, clienteId)
    expect(semCliente.elementos.some((e) => e.id === clienteId || e.id === atributoId)).toBe(false)
    expect(semCliente.ligacoes).toEqual([])
    expect(problemasDoConceitual(semCliente)).toEqual([])

    const semRelacionamento = removerElemento(ligado.conceitual, fazId)
    expect(semRelacionamento.elementos.some((e) => e.id === fazId)).toBe(false)
    expect(semRelacionamento.ligacoes).toEqual([])
  })

  it('duplica entidade com seus atributos (ids novos, nome único) sem duplicar participações', () => {
    const { conceitual: c1, id: clienteId } = adicionarEntidade(vazio(), { x: 0, y: 0 })
    const { conceitual: c2, id: atributoId } = adicionarAtributo(c1, clienteId, { x: 10, y: 10 }) ?? { conceitual: c1, id: '' }
    const { conceitual: c3, id: fazId } = adicionarRelacionamento(c2, { x: 50, y: 50 })
    const ligado = criarParticipacao(c3, fazId, clienteId)
    if (!ligado.ok) throw new Error('deveria ligar')

    const resultado = duplicarEntidade(ligado.conceitual, clienteId)
    if (!resultado) throw new Error('deveria duplicar')

    expect(resultado.conceitual.elementos.find((e) => e.id === resultado.id)).toMatchObject({ nome: 'entidade1_copia' })
    const atributosCopia = atributosDe(resultado.conceitual, resultado.id)
    expect(atributosCopia).toHaveLength(1)
    expect(atributosCopia[0]?.id).not.toBe(atributoId)
    expect(participacoesDe(resultado.conceitual, fazId)).toHaveLength(1)
    expect(problemasDoConceitual(resultado.conceitual)).toEqual([])
  })

  it('atributo composto: subatributo pende de outro atributo', () => {
    const { conceitual: c1, id: entidadeId } = adicionarEntidade(vazio(), { x: 0, y: 0 })
    const pai = adicionarAtributo(c1, entidadeId, { x: 10, y: 10 })
    if (!pai) throw new Error('deveria criar o atributo')
    const filho = adicionarAtributo(pai.conceitual, pai.id, { x: 20, y: 20 })
    if (!filho) throw new Error('deveria criar o subatributo')

    expect(atributosDe(filho.conceitual, pai.id)).toHaveLength(1)
    expect(problemasDoConceitual(filho.conceitual)).toEqual([])

    // Excluir o pai leva o filho junto.
    expect(removerElemento(filho.conceitual, pai.id).elementos.some((e) => e.id === filho.id)).toBe(false)
  })

  it('especialização só nasce sobre entidade e liga filhas sem repetir nem incluir a genérica', () => {
    const { conceitual: c1, id: pessoaId } = adicionarEntidade(vazio(), { x: 0, y: 0 })
    const { conceitual: c2, id: alunoId } = adicionarEntidade(c1, { x: 100, y: 100 })
    const criada = adicionarEspecializacao(c2, pessoaId, { x: 0, y: 80 })
    if (!criada) throw new Error('deveria criar a especialização')

    expect(especializacoesDe(criada.conceitual, pessoaId)).toHaveLength(1)
    expect(adicionarEspecializacao(criada.conceitual, 'inexistente', { x: 0, y: 0 })).toBeNull()

    const ligada = criarFilhoEspecializacao(criada.conceitual, criada.id, alunoId)
    expect(ligada.ok).toBe(true)
    if (!ligada.ok) return
    expect(filhosDaEspecializacao(ligada.conceitual, criada.id)).toHaveLength(1)
    expect(problemasDoConceitual(ligada.conceitual)).toEqual([])

    expect(criarFilhoEspecializacao(ligada.conceitual, criada.id, alunoId).ok).toBe(false)
    expect(criarFilhoEspecializacao(ligada.conceitual, criada.id, pessoaId)).toEqual({
      ok: false,
      erro: 'A entidade genérica não pode ser filha da própria especialização.',
    })

    const atualizada = atualizarEspecializacao(ligada.conceitual, criada.id, { total: true, disjunta: false })
    expect(atualizada.elementos.find((e) => e.id === criada.id)).toMatchObject({ total: true, disjunta: false })

    // Excluir a genérica leva a especialização e a ligação junto.
    const semPessoa = removerElemento(atualizada, pessoaId)
    expect(semPessoa.elementos.some((e) => e.id === criada.id)).toBe(false)
    expect(semPessoa.ligacoes).toEqual([])
  })

  it('entidade associativa: marca, participa de outro relacionamento e só desmarca quando ninguém depende', () => {
    const { conceitual: c1, id: medicoId } = adicionarEntidade(vazio(), { x: 0, y: 0 })
    const { conceitual: c2, id: consultaId } = adicionarRelacionamento(c1, { x: 100, y: 0 })
    const ligado = criarParticipacao(c2, consultaId, medicoId)
    if (!ligado.ok) throw new Error('deveria ligar')

    // Sem ser associativa, relacionamento não participa de outro relacionamento.
    const { conceitual: c3, id: geraId } = adicionarRelacionamento(ligado.conceitual, { x: 200, y: 0 })
    expect(criarParticipacao(c3, geraId, consultaId).ok).toBe(false)

    const marcada = definirAssociativa(c3, consultaId, true)
    expect(marcada.ok).toBe(true)
    if (!marcada.ok) return

    const comAssociativa = criarParticipacao(marcada.conceitual, geraId, consultaId)
    expect(comAssociativa.ok).toBe(true)
    if (!comAssociativa.ok) return
    expect(problemasDoConceitual(comAssociativa.conceitual)).toEqual([])

    expect(definirAssociativa(comAssociativa.conceitual, consultaId, false)).toEqual({
      ok: false,
      erro: 'Remova as ligações que tratam este relacionamento como entidade antes de desmarcar.',
    })
    expect(definirAssociativa(marcada.conceitual, consultaId, false).ok).toBe(true)
  })
})
