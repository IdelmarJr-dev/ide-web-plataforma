import { useCallback, useId, useState } from 'react'
import type { ChangeEvent, ReactNode, SyntheticEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '~components/Button/Button'
import { Input } from '~components/Input/Input'
// Import direto (não pelo barrel `~features/turmas`), que também exporta TurmasProfessorPage.
import { turmasService } from '~features/turmas/services/turmasService'
import { useAuth } from '../context/authContext'
import { PAPEIS_REGISTRAVEIS, registroSchema } from '../types'
import type { PapelRegistravel } from '../types'

interface FieldErrors {
  nome?: string
  email?: string
  senha?: string
}

const PAPEL_LABELS: Record<PapelRegistravel, string> = {
  aluno: 'Aluno',
  professor: 'Professor',
}

interface RegistroFormProps {
  papelInicial?: PapelRegistravel
  codigoInicial?: string
}

export const RegistroForm = ({ papelInicial = 'professor', codigoInicial = '' }: RegistroFormProps): ReactNode => {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [papel, setPapel] = useState<PapelRegistravel>(papelInicial)
  const [codigoTurma, setCodigoTurma] = useState(codigoInicial)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const { registrar, isRegistroPending, registroError } = useAuth()
  const navigate = useNavigate()
  const papelSelectId = useId()
  const codigoTurmaId = useId()

  const handleSubmit = useCallback(
    (event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault()

      const result = registroSchema.safeParse({ nome, email, senha, papel })
      if (!result.success) {
        const errors: FieldErrors = {}
        for (const issue of result.error.issues) {
          const fieldName = issue.path[0]
          if (fieldName === 'nome' || fieldName === 'email' || fieldName === 'senha') {
            errors[fieldName] = issue.message
          }
        }
        setFieldErrors(errors)
        return
      }

      setFieldErrors({})
      registrar(result.data)
        .then(async () => {
          // Matricular é best-effort: se falhar (código errado, turma encerrada), a conta já
          // foi criada — o aluno tenta de novo pelo painel em vez de perder o cadastro.
          if (papel === 'aluno' && codigoTurma.trim() !== '') {
            await turmasService.matricular(codigoTurma.trim()).catch(() => undefined)
          }
          void navigate('/dashboard')
        })
        // erro já é exposto de forma reativa via `registroError`
        .catch(() => undefined)
    },
    [nome, email, senha, papel, codigoTurma, registrar, navigate],
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Input
        label="Nome"
        name="nome"
        value={nome}
        onChange={(event: ChangeEvent<HTMLInputElement>) => { setNome(event.target.value) }}
        errorMessage={fieldErrors.nome}
      />
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
      <div className="flex flex-col gap-1">
        <label htmlFor={papelSelectId} className="text-sm font-medium text-neutral-900">
          Papel
        </label>
        <select
          id={papelSelectId}
          name="papel"
          value={papel}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => { setPapel(event.target.value as PapelRegistravel) }}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {PAPEIS_REGISTRAVEIS.map((option) => (
            <option key={option} value={option}>
              {PAPEL_LABELS[option]}
            </option>
          ))}
        </select>
      </div>
      {papel === 'aluno' ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={codigoTurmaId} className="text-sm font-medium text-neutral-900">
            Código da turma <span className="font-normal text-neutral-500">(opcional)</span>
          </label>
          <input
            id={codigoTurmaId}
            name="codigoTurma"
            value={codigoTurma}
            onChange={(event: ChangeEvent<HTMLInputElement>) => { setCodigoTurma(event.target.value) }}
            placeholder="Ex.: G8UZKN"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm uppercase outline-none
              focus-visible:ring-2 focus-visible:ring-primary-500"
          />
          <p className="text-xs text-neutral-500">
            Já tem o código do professor? Coloque aqui e você entra direto na turma. Pode deixar em branco e
            fazer isso depois, pelo seu painel.
          </p>
        </div>
      ) : null}
      {registroError ? (
        <p role="alert" className="text-sm text-danger-500">
          {registroError.message}
        </p>
      ) : null}
      <Button type="submit" isLoading={isRegistroPending}>
        Criar conta
      </Button>
    </form>
  )
}

export default RegistroForm
