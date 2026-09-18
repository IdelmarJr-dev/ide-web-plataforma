import { expect, test } from '@playwright/test'
import { exercicio, painelAlunoVazio, simularApi } from './apiSimulada'

const TURMA = {
  id: 't1',
  nome: 'Banco de Dados I',
  disciplina: 'Banco de Dados',
  semestre: '2026.2',
  turno: null,
  sala: null,
  professorId: 'p1',
  codigo: 'ABC123',
  encerradaEm: null,
  criadoEm: '2026-09-01T00:00:00.000Z',
}

function exercicioDoAluno(mudancas: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...exercicio(),
    estado: 'nao_iniciou',
    turmaId: 't1',
    turmaNome: 'Banco de Dados I',
    disciplina: 'Banco de Dados',
    gabaritoLiberado: false,
    finalizadoEm: null,
    ...mudancas,
  }
}

/**
 * Fase 9, D7 — esta é a garantia da coleta. O dashboard do aluno foi reorganizado, mas o
 * caminho banner → TCLE, que é como o participante entra na pesquisa, não pode quebrar.
 */
test('o aluno chega ao TCLE pelo banner no topo do painel', async ({ page }) => {
  await simularApi(page, {
    turmas: [TURMA],
    participacao: { pesquisa: { id: 'p1', turmaId: 't1' }, tcle: 'pendente', rtlxRespondido: false },
  })
  await page.goto('/dashboard')

  await expect(page.getByText('A pesquisa do TCC começou.')).toBeVisible()

  await page.getByRole('link', { name: /ver o termo de consentimento/i }).click()

  await expect(page).toHaveURL(/\/tcle$/)
})

test('sem pesquisa ativa o painel não mostra banner nenhum', async ({ page }) => {
  await simularApi(page, { turmas: [TURMA] })
  await page.goto('/dashboard')

  await expect(page.getByRole('heading', { name: /olá/i })).toBeVisible()
  await expect(page.getByText('A pesquisa do TCC começou.')).toBeHidden()
})

test('o painel reúne o que falta fazer de todas as turmas', async ({ page }) => {
  await simularApi(page, {
    turmas: [TURMA],
    painelAluno: painelAlunoVazio({
      resumo: { turmas: 1, pendentes: 1, entregues: 0, acertos: 0 },
      disciplinas: [{ disciplina: 'Banco de Dados', turmas: [{ ...TURMA, exercicios: [exercicioDoAluno()] }] }],
      pendencias: [exercicioDoAluno()],
    }),
  })
  await page.goto('/dashboard')

  await expect(page.getByRole('heading', { name: 'O que falta fazer' })).toBeVisible()
  // Cabeçalho da disciplina (nível 2), distinto do nome da turma "Banco de Dados I".
  await expect(page.getByRole('heading', { name: 'Banco de Dados', exact: true, level: 2 })).toBeVisible()
  // Duas vezes de propósito: em "o que falta fazer" e dentro da turma dele.
  await expect(page.getByRole('link', { name: 'Clientes e pedidos' })).toHaveCount(2)
})
