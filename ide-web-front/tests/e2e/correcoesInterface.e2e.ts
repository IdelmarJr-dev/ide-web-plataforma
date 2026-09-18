import { expect, test } from '@playwright/test'
import { documentoLogico, exercicio, simularApi } from './apiSimulada'

const PROFESSOR = { id: 'p1', nome: 'Ana Lima', email: 'ana@ifpi.edu.br', papel: 'professor', turmaId: null }

test('URL desconhecida mostra a página 404 com caminho de volta, não tela em branco', async ({ page }) => {
  await simularApi(page)
  await page.goto('/pagina-que-nao-existe')

  await expect(page.getByRole('heading', { name: 'Esta página não existe' })).toBeVisible()
  await expect(page.getByRole('link', { name: /voltar ao início|ir para o login/i })).toBeVisible()
})

test('dashboard do professor leva à área de turmas sem precisar decorar a URL', async ({ page }) => {
  await simularApi(page, { usuario: PROFESSOR })
  await page.goto('/dashboard')

  const atalho = page.getByRole('link', { name: /gerenciar turmas|minhas turmas/i })
  await expect(atalho).toBeVisible()
  await atalho.click()
  await expect(page).toHaveURL(/\/admin\/turmas$/)
})

test('revisão diz que o aluno não entregou modelagem, em vez de mostrar canvas vazio', async ({ page }) => {
  await simularApi(page, {
    usuario: PROFESSOR,
    exercicio: exercicio({ modoMer: 'conceitual', temSql: false, merGabarito: documentoLogico([]) }),
    diagramaDoAluno: undefined,
  })
  await page.goto('/admin/turmas/t1/exercicios/e1/revisar/u1')

  await expect(page.getByText(/não entregou modelagem/i)).toBeVisible()
  await expect(page.locator('.react-flow')).toHaveCount(0)
})
