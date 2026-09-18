import type { ReactNode } from 'react'
import { RtlxForm } from '../components/RtlxForm'

export const RtlxPage = (): ReactNode => {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold text-neutral-900">Questionário RTLX</h1>
      <p className="mt-1 text-sm text-neutral-600">NASA Raw-TLX — carga de trabalho percebida durante as tarefas.</p>
      <div className="mt-6">
        <RtlxForm />
      </div>
    </div>
  )
}

export default RtlxPage
