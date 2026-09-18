import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '~components/Button/Button'
import { Modal } from '~components/Modal/Modal'
import type { ModeloConceitual } from '../../../modelagem/documento'
import { converter, identificarPendencias, ROTULOS_ESTRATEGIA } from '../../../modelagem/conceitual/conversao'
import type { EscolhasConversao, ResultadoConversao } from '../../../modelagem/conceitual/conversao'

interface AssistenteConversaoProps {
  conceitual: ModeloConceitual
  escolhasIniciais: EscolhasConversao
  // true quando já existe um lógico que será substituído.
  substituiLogico: boolean
  onCancelar: () => void
  onConverter: (resultado: ResultadoConversao, escolhas: EscolhasConversao) => void
}

/**
 * Pergunta o que o modelo conceitual não decide sozinho (hoje: 1:1 — D6) e mostra o
 * resultado antes de gravar. As regras ficam em `conceitual/conversao.ts`.
 */
export const AssistenteConversao = ({
  conceitual,
  escolhasIniciais,
  substituiLogico,
  onCancelar,
  onConverter,
}: AssistenteConversaoProps): ReactNode => {
  const [escolhas, setEscolhas] = useState<EscolhasConversao>(escolhasIniciais)

  const pendencias = useMemo(() => identificarPendencias(conceitual, escolhas), [conceitual, escolhas])
  const previa = useMemo(() => converter(conceitual, escolhas), [conceitual, escolhas])

  const contagem = `${String(previa.logico.tabelas.length)} ${previa.logico.tabelas.length === 1 ? 'tabela' : 'tabelas'}`

  return (
    <Modal title="Converter para o modelo lógico" isOpen onClose={onCancelar} fecharComEsc={false}>
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
        {pendencias.length === 0 ? (
          <p className="text-sm text-neutral-700">
            O modelo conceitual não tem nenhuma decisão em aberto: as regras de conversão dão conta sozinhas.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-neutral-700">
              Relacionamentos <strong>1:1</strong> e <strong>especializações</strong> podem virar tabelas de mais de um
              jeito. Escolha um para cada:
            </p>
            {pendencias.map((pendencia) => (
              <fieldset key={pendencia.elementoId} className="rounded-md border border-neutral-200 p-3">
                <legend className="px-1 text-sm font-semibold text-neutral-900">{pendencia.rotulo}</legend>
                <div className="flex flex-col gap-1.5">
                  {pendencia.opcoes.map((opcao) => {
                    const id = `${pendencia.elementoId}-${opcao}`
                    return (
                      <div key={opcao} className="flex items-start gap-2 text-sm text-neutral-800">
                        <input
                          id={id}
                          type="radio"
                          name={pendencia.elementoId}
                          value={opcao}
                          checked={pendencia.escolhaAtual === opcao}
                          onChange={() => {
                            setEscolhas((atuais) => ({ ...atuais, [pendencia.elementoId]: opcao }))
                          }}
                          className="mt-1 h-4 w-4 accent-primary-600"
                        />
                        <label htmlFor={id}>
                          <span className="font-medium">{ROTULOS_ESTRATEGIA[opcao]}</span>
                          <span className="block text-xs text-neutral-600">{pendencia.explicacoes[opcao]}</span>
                        </label>
                      </div>
                    )
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        )}

        <div className="rounded-md bg-neutral-50 p-3">
          <p className="text-sm font-medium text-neutral-900">Resultado: {contagem}</p>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-700">
            {previa.logico.tabelas.map((tabela) => (
              <li key={tabela.id} className="font-mono">
                {tabela.nome} ({String(tabela.colunas.length)})
              </li>
            ))}
          </ul>
        </div>

        {previa.avisos.length > 0 ? (
          <ul className="flex flex-col gap-1 rounded-md bg-amber-50 p-2">
            {previa.avisos.map((aviso) => (
              <li key={aviso} className="text-xs text-amber-900">⚠ {aviso}</li>
            ))}
          </ul>
        ) : null}

        {substituiLogico ? (
          <p role="alert" className="rounded-md bg-danger-50 p-2 text-xs text-danger-700">
            Converter de novo substitui o modelo lógico atual. As edições que você fez direto nas tabelas são perdidas
            (dá para desfazer com Ctrl+Z).
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button
            disabled={previa.logico.tabelas.length === 0}
            onClick={() => { onConverter(previa, escolhas) }}
          >
            {substituiLogico ? 'Converter de novo' : 'Converter'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default AssistenteConversao
