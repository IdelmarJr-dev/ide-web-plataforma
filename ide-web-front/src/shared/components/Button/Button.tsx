import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'danger' | 'ghost'
  isLoading?: boolean
  // Texto durante a espera, quando "Carregando…" não diz o que está acontecendo.
  loadingLabel?: string
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 focus-visible:outline-primary-600',
  danger: 'bg-danger-500 text-white hover:bg-danger-600 focus-visible:outline-danger-500',
  ghost: 'bg-transparent text-neutral-900 hover:bg-neutral-100 focus-visible:outline-neutral-600',
}

export const Button = ({
  children,
  variant = 'primary',
  isLoading = false,
  loadingLabel,
  disabled,
  className,
  ...rest
}: ButtonProps): ReactNode => {
  return (
    <button
      type="button"
      disabled={disabled ?? isLoading}
      aria-busy={isLoading}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium
        transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline
        focus-visible:outline-2 focus-visible:outline-offset-2 ${VARIANT_CLASSES[variant]} ${className ?? ''}`}
      {...rest}
    >
      {isLoading ? (loadingLabel ?? 'Carregando…') : children}
    </button>
  )
}

export default Button
