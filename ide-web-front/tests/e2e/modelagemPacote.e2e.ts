import { expect, test } from '@playwright/test'
import { atributo, coluna, entidade, exercicio, simularApi } from './apiSimulada'

// Aluno que já desenhou o conceitual e converteu: serve para checar as duas imagens do PDF.
const DOIS_MODELOS = {
  versao: 2,
  conversao: null,
  conceitual: {
    elementos: [entidade('e-cliente', 'cliente', 0, 0), atributo('a-codigo', 'codigo', 'e-cliente', { chave: true, x: -80, y: -140 })],
    ligacoes: [],
    visaoAtributos: 'circulos',
  },
  logico: {
    tabelas: [{ id: 't-cliente', posicao: { x: 0, y: 0 }, nome: 'cliente', colunas: [coluna('c-codigo', 'codigo', { pk: true, notNull: true })] }],
    notas: [],
  },
}

test('PDF do exercício leva uma imagem de cada nível e o SQL do modelo', async ({ page }) => {
  const api = await simularApi(page, {
    exercicio: exercicio({ modoMer: 'conceitual_logico', temSql: false }),
    diagrama: DOIS_MODELOS,
  })
  await page.goto('/exercicios/e1')

  await expect(page.getByRole('tab', { name: '2. Lógico' })).toBeVisible()
  await expect(page.locator('[data-testid="tabela-node"]')).toHaveCount(1)

  await page.getByRole('button', { name: 'Baixar PDF' }).click()
  await expect.poll(() => api.pacotes.length, { timeout: 20_000 }).toBe(1)

  const pacote = api.pacotes[0]
  expect(pacote?.imagens?.map((imagem) => imagem.rotulo)).toEqual(['Modelo conceitual', 'Modelo lógico'])
  expect(pacote?.imagens?.every((imagem) => imagem.pngBase64.length > 100)).toBe(true)
  expect(pacote?.sqlModelo).toContain('CREATE TABLE cliente')

  // Depois da captura, o editor volta para a aba que o aluno estava vendo.
  await expect(page.getByRole('tab', { name: '2. Lógico' })).toHaveAttribute('aria-selected', 'true')

  // Baixar não encerra nada: o sandbox só cai quando o aluno finaliza de propósito.
  expect(api.finalizacoes).toBe(0)
})

test('finalizar sem ter baixado o PDF avisa antes de encerrar', async ({ page }) => {
  const api = await simularApi(page, { exercicio: exercicio({ temMer: false, temSql: true }) })
  await page.goto('/exercicios/e1')

  await page.getByRole('button', { name: 'Finalizar', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Finalizar sem baixar o PDF?' })).toBeVisible()
  expect(api.finalizacoes).toBe(0)

  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('heading', { name: 'Finalizar sem baixar o PDF?' })).toBeHidden()
  expect(api.finalizacoes).toBe(0)
})

test('depois de baixar, finalizar confirma sem o aviso de arquivo pendente', async ({ page }) => {
  const api = await simularApi(page, { exercicio: exercicio({ temMer: false, temSql: true }) })
  await page.goto('/exercicios/e1')

  await page.getByRole('button', { name: 'Baixar PDF' }).click()
  await expect.poll(() => api.pacotes.length, { timeout: 20_000 }).toBe(1)

  await page.getByRole('button', { name: 'Finalizar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Finalizar o exercício?' })).toBeVisible()

  await page.getByRole('button', { name: 'Finalizar', exact: true }).last().click()
  await expect.poll(() => api.finalizacoes).toBe(1)
})
