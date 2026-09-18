import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  errorMessage?: string | undefined
}

export const Input = ({ label, errorMessage, id, className, ...rest }: InputProps): ReactNode => {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-neutral-900">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={Boolean(errorMessage)}
        aria-describedby={errorMessage ? errorId : undefined}
        className={`rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2
          focus-visible:ring-primary-500 ${errorMessage ? 'border-danger-500' : 'border-neutral-300'} ${className ?? ''}`}
        {...rest}
      />
      {errorMessage ? (
        <p id={errorId} role="alert" className="text-sm text-danger-500">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}

export default Input
