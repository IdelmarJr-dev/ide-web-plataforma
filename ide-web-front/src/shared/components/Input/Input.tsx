import { useId, useState } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  errorMessage?: string | undefined
}

const EyeIcon = (): ReactNode => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-5">
    <path
      d="M1.5 10s3-6 8.5-6 8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

const EyeOffIcon = (): ReactNode => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-5">
    <path
      d="M1.5 10s3-6 8.5-6 8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M2.5 2.5l15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

export const Input = ({ label, errorMessage, id, className, type, ...rest }: InputProps): ReactNode => {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`
  const isPassword = type === 'password'
  const [senhaVisivel, setSenhaVisivel] = useState(false)

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-neutral-900">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={isPassword && senhaVisivel ? 'text' : type}
          aria-invalid={Boolean(errorMessage)}
          aria-describedby={errorMessage ? errorId : undefined}
          className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2
            focus-visible:ring-primary-500 ${errorMessage ? 'border-danger-500' : 'border-neutral-300'} ${isPassword ? 'pr-10' : ''} ${className ?? ''}`}
          {...rest}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => { setSenhaVisivel((atual) => !atual) }}
            aria-label={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-400 hover:text-neutral-600"
          >
            {senhaVisivel ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        ) : null}
      </div>
      {errorMessage ? (
        <p id={errorId} role="alert" className="text-sm text-danger-500">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}

export default Input
