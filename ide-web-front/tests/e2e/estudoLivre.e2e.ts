import { expect, test } from '@playwright/test'
import { exercicio, painelAlunoVazio, simularApi } from './apiSimulada'

const TURMA_ABERTA = {
  id: 't1',
  nome: 'Banco de Dados',
  disciplina: 'Banco de Dados',
  semestre: '2026.2',
  turno: null,
  sala: null,
  professorId: 'p1',
  codigo: 'ABC123',
  encerradaEm: null,
  criadoEm: '2026-09-01T00:00:00.000Z',
}

// O aluno alcança a IDE sem pertencer a turma nenhuma — é o ponto central da Fase 8.
test('aluno sem turma nenhuma chega ao estudo livre pelo painel', async ({ page }) => {
  await simularApi(page, { turmas: [] })
  await page.goto('/dashboard')

  await expect(page.getByText(/você ainda não está em nenhuma turma/i)).toBeVisible()

  // Link específico do card do painel — a barra de navegação do topo também tem um,
  // então "estudar sozinho" sozinho é ambíguo (strict mode do Playwright).
  const cardEstudoLivre = page.locator('section', { hasText: 'Seu próprio banco pra praticar SQL' })
  await cardEstudoLivre.getByRole('link', { name: /estudar sozinho/i }).click()

  await expect(page.getByRole('heading', { name: 'Estudar sozinho' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Meu banco' })).toBeVisible()
})

test('banco livre executa o comando do aluno e mostra o resultado', async ({ page }) => {
  await simularApi(page, {
    turmas: [],
    resultadoLivre: { status: 'sucesso', rows: [{ id: 1, nome: 'Ana' }] },
  })
  await page.goto('/estudar')

  await page.getByLabel('Comando SQL').fill('SELECT * FROM aluno;')
  await page.getByRole('button', { name: 'Executar' }).click()

  await expect(page.getByRole('cell', { name: 'Ana' })).toBeVisible()
})

test('limpar o banco livre pede confirmação antes', async ({ page }) => {
  await simularApi(page, { turmas: [] })
  await page.goto('/estudar')

  await page.getByRole('button', { name: 'Limpar meu banco' }).click()

  await expect(page.getByRole('heading', { name: 'Apagar tudo do seu banco?' })).toBeVisible()
  await expect(page.getByText(/não dá pra desfazer/i)).toBeVisible()
})

test('exercícios públicos aparecem sem exigir matrícula', async ({ page }) => {
  await simularApi(page, {
    turmas: [],
    exerciciosPublicos: [exercicio({ publico: true, titulo: 'Junções para iniciantes' })],
  })
  await page.goto('/estudar')

  await page.getByRole('tab', { name: 'Exercícios públicos' }).click()

  await expect(page.getByRole('link', { name: 'Junções para iniciantes' })).toBeVisible()
})

test('turma encerrada aparece marcada e avisa que não aceita mais entregas', async ({ page }) => {
  const encerrada = { ...TURMA_ABERTA, encerradaEm: '2026-09-15T12:00:00.000Z' }
  await simularApi(page, {
    turmas: [encerrada],
    painelAluno: painelAlunoVazio({
      resumo: { turmas: 1, pendentes: 0, entregues: 0, acertos: 0 },
      disciplinas: [{ disciplina: 'Banco de Dados', turmas: [{ ...encerrada, exercicios: [] }] }],
    }),
  })
  await page.goto('/dashboard')

  await expect(page.getByText('Encerrada', { exact: true })).toBeVisible()
  await expect(page.getByText(/não envia mais nada/i)).toBeVisible()
})
