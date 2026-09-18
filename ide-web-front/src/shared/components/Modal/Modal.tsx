import { useEffect } from 'react'
import type { ReactNode } from 'react'

interface ModalProps {
  title: string
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  size?: 'md' | 'xl'
  // Desligue quando o conteúdo usa Esc (ex.: editor de modelagem), pra não perder trabalho.
  fecharComEsc?: boolean
}

const SIZE_CLASSES: Record<NonNullable<ModalProps['size']>, string> = {
  md: 'max-w-md',
  xl: 'max-w-[95vw]',
}

export const Modal = ({ title, isOpen, onClose, children, size = 'md', fecharComEsc = true }: ModalProps): ReactNode => {
  useEffect(() => {
    if (!isOpen || !fecharComEsc) return

    const handleEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleEscape)
    return () => { document.removeEventListener('keydown', handleEscape) }
  }, [isOpen, onClose, fecharComEsc])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-neutral-900/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative z-10 mx-4 w-full ${SIZE_CLASSES[size]} rounded-md bg-white p-6 shadow-lg`}
      >
        <h2 id="modal-title" className="text-lg font-semibold text-neutral-900">
          {title}
        </h2>
        <div className="mt-4">{children}</div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 rounded-md p-1 text-neutral-600 hover:bg-neutral-100
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default Modal
