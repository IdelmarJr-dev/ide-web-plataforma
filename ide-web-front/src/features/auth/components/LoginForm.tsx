import { useCallback, useState } from 'react'
import type { ChangeEvent, ReactNode, SyntheticEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '~components/Button/Button'
import { Input } from '~components/Input/Input'
import { useAuth } from '../context/authContext'
import { loginSchema } from '../types'

interface FieldErrors {
  email?: string
  senha?: string
}

export const LoginForm = (): ReactNode => {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const { login, isLoginPending, loginError } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = useCallback(
    (event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault()

      const result = loginSchema.safeParse({ email, senha })
      if (!result.success) {
        const errors: FieldErrors = {}
        for (const issue of result.error.issues) {
          const fieldName = issue.path[0]
          if (fieldName === 'email' || fieldName === 'senha') errors[fieldName] = issue.message
        }
        setFieldErrors(errors)
        return
      }

      setFieldErrors({})
      login(result.data)
        .then(() => {
          void navigate('/dashboard')
        })
        // erro já é exposto de forma reativa via `loginError`
        .catch(() => undefined)
    },
    [email, senha, login, navigate],
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Input
        label="E-mail"
        name="email"
        type="email"
        value={email}
        onChange={(event: ChangeEvent<HTMLInputElement>) => { setEmail(event.target.value) }}
        errorMessage={fieldErrors.email}
      />
      <Input
        label="Senha"
        name="senha"
        type="password"
        value={senha}
        onChange={(event: ChangeEvent<HTMLInputElement>) => { setSenha(event.target.value) }}
        errorMessage={fieldErrors.senha}
      />
      {loginError ? (
        <p role="alert" className="text-sm text-danger-500">
          {loginError.message}
        </p>
      ) : null}
      <Button type="submit" isLoading={isLoginPending}>
        Entrar
      </Button>
    </form>
  )
}

export default LoginForm
