import type { ChangeEvent, ReactNode } from 'react'
import type { Coluna, ModeloLogico, TipoColuna } from '../../../modelagem/documento'
import { TIPOS_COLUNA, TIPOS_COM_TAMANHO, TIPOS_INTEIROS } from '../../../modelagem/documento'
import { normalizarIdentificador } from '../../../modelagem/identificadores'
import type { SelecaoLogico } from '../../../modelagem/logico/editorContexto'
import {
  adicionarColuna,
  atualizarColuna,
  atualizarNota,
  duplicarTabela,
  ligacoesFk,
  moverColuna,
  removerColuna,
  removerLigacao,
  removerNota,
  removerTabela,
  renomearTabela,
} from '../../../modelagem/logico/operacoes'

type Atualizacao = (logico: ModeloLogico) => ModeloLogico

interface PainelPropriedadesLogicoProps {
  logico: ModeloLogico
  selecao: SelecaoLogico | null
  avisos: string[]
  somenteLeitura: boolean
  onAplicar: (atualizar: Atualizacao, chave?: string) => void
  onEncerrarGesto: () => void
  onSelecionar: (selecao: SelecaoLogico | null) => void
}

const CLASSE_CAMPO =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:bg-neutral-50'
const CLASSE_BOTAO_TEXTO = 'text-xs font-medium text-primary-600 hover:underline disabled:text-neutral-400 disabled:no-underline'
const CLASSE_BOTAO_PERIGO = 'text-xs font-medium text-danger-600 hover:underline'

const Campo = ({ rotulo, children }: { rotulo: string; children: ReactNode }): ReactNode => (
  <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
    {rotulo}
    {children}
  </label>
)

const Caixa = ({ rotulo, marcado, desabilitado = false, dica, onChange }: {
  rotulo: string
  marcado: boolean
  desabilitado?: boolean
  dica?: string
  onChange: (marcado: boolean) => void
}): ReactNode => (
  <label className={`flex items-center gap-2 text-sm ${desabilitado ? 'text-neutral-400' : 'text-neutral-800'}`} title={dica}>
    <input
      type="checkbox"
      checked={marcado}
      disabled={desabilitado}
      onChange={(evento) => { onChange(evento.target.checked) }}
      className="h-4 w-4 accent-primary-600"
    />
    {rotulo}
  </label>
)

const Titulo = ({ children }: { children: ReactNode }): ReactNode => (
  <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{children}</h3>
)

function avisosQueCitam(avisos: string[], nome: string): string[] {
  return nome ? avisos.filter((aviso) => aviso.includes(`"${nome}`)) : []
}

const ListaAvisos = ({ avisos }: { avisos: string[] }): ReactNode =>
  avisos.length === 0 ? null : (
    <ul className="flex flex-col gap-1 rounded-md bg-amber-50 p-2">
      {avisos.map((aviso) => (
        <li key={aviso} className="text-xs text-amber-900">⚠ {aviso}</li>
      ))}
    </ul>
  )

const Orientacao = (): ReactNode => (
  <div className="flex flex-col gap-3 text-xs text-neutral-700">
    <Titulo>Modelo lógico</Titulo>
    <p>Adicione tabelas pela paleta. Clique numa tabela ou coluna para editar aqui.</p>
    <p>
      <strong>Chave estrangeira:</strong> arraste da alça azul da tabela referenciada (lado 1) e solte sobre a outra
      tabela. A coluna FK é criada com o nome e o tipo da chave primária.
    </p>
    <p>
      <strong>(mín,máx)</strong> junto de uma tabela indica com quantas linhas dela uma linha da outra se associa.
    </p>
    <p className="text-neutral-500">Atalhos com o foco no desenho: Delete exclui, Ctrl+Z desfaz, Ctrl+Y refaz, Ctrl+D duplica.</p>
  </div>
)

export const PainelPropriedadesLogico = ({
  logico,
  selecao,
  avisos,
  somenteLeitura,
  onAplicar,
  onEncerrarGesto,
  onSelecionar,
}: PainelPropriedadesLogicoProps): ReactNode => {
  const conteudo = (): ReactNode => {
    if (!selecao) return <Orientacao />

    if (selecao.tipo === 'nota') {
      const nota = logico.notas.find((existente) => existente.id === selecao.id)
      if (!nota) return <Orientacao />
      return (
        <div className="flex flex-col gap-3">
          <Titulo>Nota</Titulo>
          <Campo rotulo="Texto">
            <textarea
              className={`${CLASSE_CAMPO} h-28 resize-none`}
              value={nota.texto}
              disabled={somenteLeitura}
              onChange={(evento) => { onAplicar((l) => atualizarNota(l, nota.id, { texto: evento.target.value }), `nota:${nota.id}`) }}
              onBlur={onEncerrarGesto}
            />
          </Campo>
          {somenteLeitura ? null : (
            <button type="button" className={CLASSE_BOTAO_PERIGO} onClick={() => { onAplicar((l) => removerNota(l, nota.id)); onSelecionar(null) }}>
              Excluir nota
            </button>
          )}
        </div>
      )
    }

    if (selecao.tipo === 'ligacao') {
      const ligacao = ligacoesFk(logico).find((existente) => existente.id === selecao.id)
      const tabela = logico.tabelas.find((existente) => existente.id === ligacao?.tabelaId)
      const referenciada = logico.tabelas.find((existente) => existente.id === ligacao?.tabelaReferenciadaId)
      if (!ligacao || !tabela || !referenciada) return <Orientacao />
      const colunas = tabela.colunas.filter((coluna) => ligacao.colunaIds.includes(coluna.id))
      const nomeTabela = normalizarIdentificador(tabela.nome)
      const nomeReferenciada = normalizarIdentificador(referenciada.nome)
      const alterarTodas = (mudancas: Partial<Coluna>): void => {
        onAplicar((l) => colunas.reduce((acc, coluna) => atualizarColuna(acc, tabela.id, coluna.id, mudancas), l))
      }
      return (
        <div className="flex flex-col gap-3 text-sm">
          <Titulo>Chave estrangeira</Titulo>
          <p className="font-mono text-xs text-neutral-800">
            {nomeTabela}({colunas.map((coluna) => normalizarIdentificador(coluna.nome)).join(', ')}) → {nomeReferenciada}
          </p>
          <p className="text-xs text-neutral-700">
            Cada <strong>{nomeTabela}</strong> se associa a <strong>{ligacao.cardinalidadeReferenciada}</strong>{' '}
            {nomeReferenciada}; cada <strong>{nomeReferenciada}</strong> a <strong>{ligacao.cardinalidadeReferenciadora}</strong>{' '}
            {nomeTabela}.
          </p>
          <Caixa
            rotulo="Obrigatória (NOT NULL)"
            marcado={colunas.every((coluna) => coluna.notNull)}
            desabilitado={somenteLeitura || colunas.some((coluna) => coluna.pk)}
            dica="Com NOT NULL, toda linha precisa referenciar a outra tabela: mínimo 1."
            onChange={(marcado) => { alterarTodas({ notNull: marcado }) }}
          />
          {colunas.length === 1 ? (
            <Caixa
              rotulo="Única (UNIQUE) — relação 1:1"
              marcado={colunas[0]?.unique === true}
              desabilitado={somenteLeitura || colunas[0]?.pk === true}
              onChange={(marcado) => { alterarTodas({ unique: marcado }) }}
            />
          ) : null}
          {somenteLeitura ? null : (
            <button
              type="button"
              className={CLASSE_BOTAO_PERIGO}
              onClick={() => { onAplicar((l) => removerLigacao(l, ligacao)); onSelecionar(null) }}
            >
              Excluir ligação (remove as colunas FK)
            </button>
          )}
        </div>
      )
    }

    const tabelaId = selecao.tipo === 'tabela' ? selecao.id : selecao.tabelaId
    const tabela = logico.tabelas.find((existente) => existente.id === tabelaId)
    if (!tabela) return <Orientacao />
    const nomeTabela = normalizarIdentificador(tabela.nome)

    if (selecao.tipo === 'coluna') {
      const coluna = tabela.colunas.find((existente) => existente.id === selecao.colunaId)
      if (!coluna) return <Orientacao />
      const nomeColuna = normalizarIdentificador(coluna.nome) || 'coluna'
      const mudar = (mudancas: Partial<Coluna>, chave?: string): void => {
        onAplicar((l) => atualizarColuna(l, tabela.id, coluna.id, mudancas), chave)
      }
      const inteiro = TIPOS_INTEIROS.includes(coluna.tipo)
      const origensFk = logico.tabelas.flatMap((outra) =>
        outra.colunas
          .filter((candidata) => (candidata.pk || candidata.unique) && candidata.id !== coluna.id)
          .map((candidata) => ({
            valor: `${outra.id}|${candidata.id}`,
            rotulo: `${normalizarIdentificador(outra.nome) || 'tabela'}.${normalizarIdentificador(candidata.nome) || 'coluna'}`,
            candidata,
            outraId: outra.id,
          })),
      )
      const numero = (evento: ChangeEvent<HTMLInputElement>): number | null => {
        const valor = Number.parseInt(evento.target.value, 10)
        return Number.isNaN(valor) ? null : valor
      }

      return (
        <div className="flex flex-col gap-3">
          <button type="button" className={`${CLASSE_BOTAO_TEXTO} self-start`} onClick={() => { onSelecionar({ tipo: 'tabela', id: tabela.id }) }}>
            ← {nomeTabela || 'tabela'}
          </button>
          <Titulo>Coluna</Titulo>
          <Campo rotulo="Nome">
            <input
              className={CLASSE_CAMPO}
              value={coluna.nome}
              disabled={somenteLeitura}
              onChange={(evento) => { mudar({ nome: evento.target.value }, `coluna-nome:${coluna.id}`) }}
              onBlur={onEncerrarGesto}
            />
          </Campo>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <Campo rotulo="Tipo">
                <select
                  className={CLASSE_CAMPO}
                  value={coluna.tipo}
                  disabled={somenteLeitura}
                  onChange={(evento) => { mudar({ tipo: evento.target.value as TipoColuna }) }}
                >
                  {TIPOS_COLUNA.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                </select>
              </Campo>
            </div>
            {TIPOS_COM_TAMANHO.includes(coluna.tipo) ? (
              <div className="w-16">
                <Campo rotulo={coluna.tipo === 'NUMERIC' ? 'Precisão' : 'Tamanho'}>
                  <input
                    type="number"
                    min={1}
                    className={CLASSE_CAMPO}
                    placeholder={coluna.tipo === 'VARCHAR' ? '255' : coluna.tipo === 'CHAR' ? '1' : '10'}
                    value={coluna.tamanho ?? ''}
                    disabled={somenteLeitura}
                    onChange={(evento) => { mudar({ tamanho: numero(evento) }, `coluna-tamanho:${coluna.id}`) }}
                    onBlur={onEncerrarGesto}
                  />
                </Campo>
              </div>
            ) : null}
            {coluna.tipo === 'NUMERIC' ? (
              <div className="w-14">
                <Campo rotulo="Escala">
                  <input
                    type="number"
                    min={0}
                    className={CLASSE_CAMPO}
                    placeholder="2"
                    value={coluna.escala ?? ''}
                    disabled={somenteLeitura}
                    onChange={(evento) => { mudar({ escala: numero(evento) }, `coluna-escala:${coluna.id}`) }}
                    onBlur={onEncerrarGesto}
                  />
                </Campo>
              </div>
            ) : null}
          </div>

          <fieldset className="grid grid-cols-2 gap-1.5" disabled={somenteLeitura}>
            <legend className="sr-only">Restrições</legend>
            <Caixa rotulo="PK" dica="Chave primária" marcado={coluna.pk} onChange={(marcado) => { mudar({ pk: marcado }) }} />
            <Caixa
              rotulo="NOT NULL"
              marcado={coluna.notNull}
              desabilitado={coluna.pk || coluna.autoIncremento}
              onChange={(marcado) => { mudar({ notNull: marcado }) }}
            />
            <Caixa rotulo="UNIQUE" marcado={coluna.unique} onChange={(marcado) => { mudar({ unique: marcado }) }} />
            <Caixa
              rotulo="Autoincremento"
              dica={inteiro ? 'GENERATED BY DEFAULT AS IDENTITY' : 'Só para tipos inteiros'}
              marcado={coluna.autoIncremento}
              desabilitado={!inteiro}
              onChange={(marcado) => { mudar({ autoIncremento: marcado }) }}
            />
          </fieldset>

          <Campo rotulo="Valor padrão (DEFAULT)">
            <input
              className={`${CLASSE_CAMPO} font-mono`}
              placeholder="ex.: 0, 'ativo', CURRENT_DATE"
              value={coluna.padrao}
              disabled={somenteLeitura}
              onChange={(evento) => { mudar({ padrao: evento.target.value }, `coluna-padrao:${coluna.id}`) }}
              onBlur={onEncerrarGesto}
            />
          </Campo>

          <Campo rotulo="Restrição de verificação (CHECK)">
            <input
              className={`${CLASSE_CAMPO} font-mono`}
              placeholder={`ex.: ${nomeColuna} > 0`}
              value={coluna.check}
              disabled={somenteLeitura}
              onChange={(evento) => { mudar({ check: evento.target.value }, `coluna-check:${coluna.id}`) }}
              onBlur={onEncerrarGesto}
            />
          </Campo>
          {somenteLeitura ? null : (
            <div className="flex flex-wrap gap-1" aria-label="Atalhos de CHECK">
              {[`${nomeColuna} > 0`, `${nomeColuna} >= 0`, `${nomeColuna} IN ('A', 'B')`, `${nomeColuna} BETWEEN 0 AND 10`].map((modelo) => (
                <button
                  key={modelo}
                  type="button"
                  className="rounded border border-neutral-300 px-1.5 py-0.5 font-mono text-[10px] text-neutral-700 hover:border-primary-500"
                  onClick={() => { mudar({ check: modelo }) }}
                >
                  {modelo.replace(nomeColuna, '…')}
                </button>
              ))}
            </div>
          )}

          <Campo rotulo="Chave estrangeira (FK) — referencia">
            <select
              className={CLASSE_CAMPO}
              disabled={somenteLeitura}
              value={coluna.fk ? `${coluna.fk.tabelaId}|${coluna.fk.colunaId}` : ''}
              onChange={(evento) => {
                const origem = origensFk.find((opcao) => opcao.valor === evento.target.value)
                mudar(
                  origem
                    ? {
                        fk: { tabelaId: origem.outraId, colunaId: origem.candidata.id },
                        tipo: origem.candidata.tipo,
                        tamanho: origem.candidata.tamanho,
                        escala: origem.candidata.escala,
                        autoIncremento: false,
                      }
                    : { fk: null },
                )
              }}
            >
              <option value="">(não é chave estrangeira)</option>
              {origensFk.map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}
            </select>
          </Campo>

          {somenteLeitura ? null : (
            <button
              type="button"
              className={`${CLASSE_BOTAO_PERIGO} self-start`}
              onClick={() => { onAplicar((l) => removerColuna(l, tabela.id, coluna.id)); onSelecionar({ tipo: 'tabela', id: tabela.id }) }}
            >
              Excluir coluna
            </button>
          )}
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-3">
        <Titulo>Tabela</Titulo>
        <Campo rotulo="Nome">
          <input
            className={CLASSE_CAMPO}
            value={tabela.nome}
            disabled={somenteLeitura}
            onChange={(evento) => { onAplicar((l) => renomearTabela(l, tabela.id, evento.target.value), `tabela-nome:${tabela.id}`) }}
            onBlur={onEncerrarGesto}
          />
        </Campo>
        <ListaAvisos avisos={avisosQueCitam(avisos, nomeTabela)} />
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-neutral-700">Colunas</p>
          <ul className="flex flex-col divide-y divide-neutral-100 rounded-md border border-neutral-200">
            {tabela.colunas.map((coluna, indice) => (
              <li key={coluna.id} className="flex items-center gap-1 px-2 py-1">
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-sm text-neutral-900 hover:text-primary-700"
                  onClick={() => { onSelecionar({ tipo: 'coluna', tabelaId: tabela.id, colunaId: coluna.id }) }}
                >
                  {coluna.pk ? '🔑 ' : ''}
                  {normalizarIdentificador(coluna.nome) || 'coluna sem nome'}
                </button>
                {somenteLeitura ? null : (
                  <>
                    <button type="button" aria-label="Mover para cima" disabled={indice === 0} className="px-1 text-xs text-neutral-600 disabled:opacity-30" onClick={() => { onAplicar((l) => moverColuna(l, tabela.id, coluna.id, -1)) }}>↑</button>
                    <button type="button" aria-label="Mover para baixo" disabled={indice === tabela.colunas.length - 1} className="px-1 text-xs text-neutral-600 disabled:opacity-30" onClick={() => { onAplicar((l) => moverColuna(l, tabela.id, coluna.id, 1)) }}>↓</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
        {somenteLeitura ? null : (
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <button
              type="button"
              className={CLASSE_BOTAO_TEXTO}
              onClick={() => {
                const resultado = adicionarColuna(logico, tabela.id)
                onAplicar(() => resultado.logico)
                onSelecionar({ tipo: 'coluna', tabelaId: tabela.id, colunaId: resultado.colunaId })
              }}
            >
              + coluna
            </button>
            <button
              type="button"
              className={CLASSE_BOTAO_TEXTO}
              onClick={() => {
                const resultado = duplicarTabela(logico, tabela.id)
                if (!resultado) return
                onAplicar(() => resultado.logico)
                onSelecionar({ tipo: 'tabela', id: resultado.tabelaId })
              }}
            >
              Duplicar
            </button>
            <button type="button" className={CLASSE_BOTAO_PERIGO} onClick={() => { onAplicar((l) => removerTabela(l, tabela.id)); onSelecionar(null) }}>
              Excluir tabela
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <aside aria-label="Propriedades" className="w-72 max-w-[75vw] shrink-0 overflow-y-auto border-l border-neutral-200 p-3">
      {conteudo()}
    </aside>
  )
}

export default PainelPropriedadesLogico
