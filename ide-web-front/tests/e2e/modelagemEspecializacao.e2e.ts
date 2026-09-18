import { expect, test } from '@playwright/test'
import { atributo, documentoConceitual, entidade, exercicio, simularApi } from './apiSimulada'

// pessoa (genérica) + aluno e professor, prontos para virar especialização.
const PESSOAS = documentoConceitual(
  [
    entidade('e-pessoa', 'pessoa', 0, 0),
    atributo('a-cpf', 'cpf', 'e-pessoa', { chave: true, x: -60, y: -120 }),
    entidade('e-aluno', 'aluno', -180, 260),
    atributo('a-matricula', 'matricula', 'e-aluno', { x: -300, y: 380 }),
    entidade('e-professor', 'professor', 200, 260),
  ],
  [],
)

test('especialização: cria, liga as filhas e converte herdando a chave da genérica', async ({ page }) => {
  await simularApi(page, {
    exercicio: exercicio({ modoMer: 'conceitual_logico', temSql: false }),
    diagrama: PESSOAS,
  })
  await page.goto('/exercicios/e1')

  const pessoa = page.locator('.react-flow__node[data-id="e-pessoa"]')
  await expect(pessoa).toBeVisible()

  // Seleciona a genérica e cria a especialização pelo painel.
  await pessoa.click()
  await page.getByRole('button', { name: '+ especialização' }).click()
  const triangulo = page.locator('.react-flow__node:has([data-testid="especializacao-node"])')
  await expect(triangulo).toBeVisible()

  // Total + disjunta libera a opção "só as especializadas" no assistente.
  const painel = page.getByRole('complementary', { name: 'Propriedades' })
  await painel.getByRole('checkbox', { name: 'Total' }).check()

  // Liga as duas filhas arrastando da alça do triângulo até cada entidade.
  for (const filha of ['e-aluno', 'e-professor']) {
    const origem = await triangulo.locator('.react-flow__handle-bottom').boundingBox()
    const destino = await page.locator(`.react-flow__node[data-id="${filha}"]`).boundingBox()
    if (!origem || !destino) throw new Error('elemento fora da tela')
    await page.mouse.move(origem.x + origem.width / 2, origem.y + origem.height / 2)
    await page.mouse.down()
    await page.mouse.move(destino.x + destino.width / 2, destino.y + destino.height / 2, { steps: 12 })
    await page.mouse.up()
  }
  await expect(painel.getByRole('button', { name: 'aluno' })).toBeVisible()
  await expect(painel.getByRole('button', { name: 'professor' })).toBeVisible()

  // Converte: o assistente pergunta o que fazer com a especialização.
  await page.getByRole('button', { name: 'Converter para lógico →' }).click()
  const assistente = page.getByRole('dialog')
  await expect(assistente).toContainText('pessoa → aluno / professor')
  await expect(assistente.getByRole('radio', { name: /Uma tabela por entidade/ })).toBeChecked()
  await expect(assistente.getByRole('radio', { name: /Só as entidades especializadas/ })).toBeVisible()
  await page.screenshot({ path: 'test-results/assistente-especializacao.png' })
  await assistente.getByRole('button', { name: 'Converter' }).click()

  // Cada especializada herda a chave da genérica como PK.
  await expect(page.getByRole('button', { name: 'Coluna pessoa_cpf de aluno' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Coluna pessoa_cpf de professor' })).toBeVisible()
  await expect(page.locator('[data-testid="tabela-node"]')).toHaveCount(3)
})
