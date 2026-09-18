import { useMemo, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { CONCEITUAL_VAZIO, LOGICO_VAZIO } from '../../modelagem/documento'
import { assinaturaConceitual } from '../../modelagem/conceitual/conversao'
import type { EscolhasConversao } from '../../modelagem/conceitual/conversao'
import type { Selecao } from '../../modelagem/sincronizacao'
import type { DocumentoEditavel } from '../../modelagem/useDocumentoEditavel'
import { AssistenteConversao } from './conceitual/AssistenteConversao'
import { ConceitualEditor } from './conceitual/ConceitualEditor'
import { LogicoEditor } from './logico/LogicoEditor'

interface ConceitualLogicoEditorProps {
  editavel: DocumentoEditavel
  somenteLeitura?: boolean
  destaque?: Selecao | null
  onSelecionar?: (selecao: Selecao) => void
  barraDireita?: ReactNode
  canvasRef?: RefObject<HTMLDivElement | null> | undefined
  // Aba imposta de fora enquanto o PDF é gerado (EditorModelagem tira uma imagem de cada modelo).
  abaForcada?: AbaModelo | null
}

export type AbaModelo = 'conceitual' | 'logico'

const CLASSE_ABA =
  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500'

/**
 * Modo conceitual → lógico: o aluno desenha o MER, converte pelo assistente e ajusta as
 * tabelas. Depois de converter os dois modelos são independentes (D7) — mudou o
 * conceitual, aparece o aviso e "Converter de novo" refaz tudo.
 */
export const ConceitualLogicoEditor = ({
  editavel,
  somenteLeitura = false,
  destaque = null,
  onSelecionar,
  barraDireita,
  canvasRef,
  abaForcada = null,
}: ConceitualLogicoEditorProps): ReactNode => {
  const { documento } = editavel
  const conceitual = documento.conceitual ?? CONCEITUAL_VAZIO
  const logico = documento.logico ?? LOGICO_VAZIO
  const jaConverteu = documento.conversao !== null
  // Quem já tem tabelas (converteu antes ou desenhou direto) abre no lógico: senão a
  // primeira tela seria um conceitual vazio e pareceria que o trabalho sumiu.
  const logicoLiberado = jaConverteu || logico.tabelas.length > 0
  const [aba, setAba] = useState<AbaModelo>(logicoLiberado ? 'logico' : 'conceitual')
  const [assistenteAberto, setAssistenteAberto] = useState(false)

  const assinaturaAtual = useMemo(() => assinaturaConceitual(conceitual), [conceitual])
  const conceitualMudou = documento.conversao !== null && documento.conversao.assinaturaConceitual !== assinaturaAtual
  const abaEscolhida = abaForcada ?? aba
  const abaAtiva = abaEscolhida === 'logico' && !logicoLiberado ? 'conceitual' : abaEscolhida

  const escolhas: EscolhasConversao = documento.conversao?.escolhas ?? {}

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Nível do modelo" className="flex gap-1 rounded-lg bg-neutral-100 p-1">
          <button
            type="button"
            role="tab"
            aria-selected={abaAtiva === 'conceitual'}
            className={`${CLASSE_ABA} ${abaAtiva === 'conceitual' ? 'bg-surface text-primary-700 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'}`}
            onClick={() => { setAba('conceitual') }}
          >
            1. Conceitual
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={abaAtiva === 'logico'}
            disabled={!logicoLiberado}
            title={logicoLiberado ? undefined : 'Converta o modelo conceitual primeiro'}
            className={`${CLASSE_ABA} disabled:cursor-not-allowed disabled:opacity-50 ${
              abaAtiva === 'logico' ? 'bg-surface text-primary-700 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
            }`}
            onClick={() => { setAba('logico') }}
          >
            2. Lógico
          </button>
        </div>

        {somenteLeitura ? null : (
          <button
            type="button"
            className="rounded-md border border-primary-600 px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-50
              disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400"
            disabled={conceitual.elementos.length === 0}
            onClick={() => { setAssistenteAberto(true) }}
          >
            {jaConverteu ? 'Converter de novo →' : 'Converter para lógico →'}
          </button>
        )}

        {conceitualMudou ? (
          <p role="status" className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">
            ⚠ O modelo conceitual mudou depois da última conversão.
          </p>
        ) : null}

        {barraDireita ? <div className="ml-auto flex items-center gap-2">{barraDireita}</div> : null}
      </div>

      <div className="min-h-0 flex-1">
        {abaAtiva === 'conceitual' ? (
          <ConceitualEditor
            conceitual={conceitual}
            onAplicar={editavel.aplicarConceitual}
            historico={editavel.controle}
            somenteLeitura={somenteLeitura}
            canvasRef={canvasRef}
          />
        ) : (
          <LogicoEditor
            logico={logico}
            onAplicar={editavel.aplicarLogico}
            historico={editavel.controle}
            somenteLeitura={somenteLeitura}
            destaque={destaque}
            {...(onSelecionar ? { onSelecionar } : {})}
            canvasRef={canvasRef}
          />
        )}
      </div>

      {assistenteAberto ? (
        <AssistenteConversao
          conceitual={conceitual}
          escolhasIniciais={escolhas}
          substituiLogico={logico.tabelas.length > 0}
          onCancelar={() => { setAssistenteAberto(false) }}
          onConverter={(resultado, escolhasUsadas) => {
            editavel.aplicarConversao(resultado.logico, {
              assinaturaConceitual: assinaturaAtual,
              convertidoEm: new Date().toISOString(),
              escolhas: escolhasUsadas,
            })
            setAssistenteAberto(false)
            setAba('logico')
          }}
        />
      ) : null}
    </div>
  )
}

export default ConceitualLogicoEditor
