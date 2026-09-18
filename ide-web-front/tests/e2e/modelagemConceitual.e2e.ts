import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { exercicio, simularApi } from './apiSimulada'

async function arrastar(page: Page, de: Locator, para: Locator): Promise<void> {
  const origem = await de.boundingBox()
  const destino = await para.boundingBox()
  if (!origem || !destino) throw new Error('elemento fora da tela')
  await page.mouse.move(origem.x + origem.width / 2, origem.y + origem.height / 2)
  await page.mouse.down()
  await page.mouse.move(destino.x + destino.width / 2, destino.y + destino.height / 2, { steps: 12 })
  await page.mouse.up()
}

test('editor conceitual: entidade + relacionamento + participação + atributo, com autosave', async ({ page }) => {
  const api = await simularApi(page, { exercicio: exercicio({ modoMer: 'conceitual', temSql: false }) })
  await page.goto('/exercicios/e1')

  const entidadeNode = page.locator('.react-flow__node:has([data-testid="entidade-node"])')
  const relacionamentoNode = page.locator('.react-flow__node:has([data-testid="relacionamento-node"])')

  await page.getByRole('button', { name: 'Entidade' }).click()
  await expect(entidadeNode).toBeVisible()

  await page.getByRole('button', { name: 'Relação' }).click()
  await expect(relacionamentoNode).toBeVisible()

  // As duas nascem quase no mesmo lugar (paleta sempre solta perto do centro) — afasta o
  // relacionamento antes de ligar, senão um cobre o outro e os cliques ficam ambíguos. Move
  // pra esquerda/baixo: à direita fica o painel de propriedades, sempre sobre o canvas.
  const relBox = await relacionamentoNode.boundingBox()
  if (!relBox) throw new Error('relacionamento fora da tela')
  await page.mouse.move(relBox.x + relBox.width / 2, relBox.y + relBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(relBox.x + relBox.width / 2 - 220, relBox.y + relBox.height / 2 + 120, { steps: 10 })
  await page.mouse.up()

  // Da alça direita do relacionamento até o corpo da entidade cria a participação.
  await arrastar(page, relacionamentoNode.locator('.react-flow__handle-right'), entidadeNode)
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await expect(page.getByTestId('rf__wrapper').getByText('(0,n)', { exact: true })).toBeVisible()

  // Seleciona a entidade e adiciona um atributo pelo painel.
  await entidadeNode.click()
  await page.getByRole('button', { name: '+ atributo' }).click()
  const atributoNode = page.locator('[data-testid="atributo-node"]')
  await expect(atributoNode).toBeVisible()

  // Visão em lista: o atributo some do canvas como círculo e passa a aparecer dentro da entidade.
  await page.getByRole('button', { name: 'Atributos em lista' }).click()
  await expect(atributoNode).toHaveCount(0)
  await expect(entidadeNode.getByText('atributo1')).toBeVisible()

  await expect(page.getByText(/Salvo às \d{2}:\d{2}/)).toBeVisible({ timeout: 10_000 })
  const ultimo = JSON.stringify(api.salvamentos.at(-1))
  expect(ultimo).toContain('"tipo":"participacao"')
  expect(ultimo).toContain('"visaoAtributos":"lista"')

  await page.screenshot({ path: 'test-results/modelagem-conceitual.png' })
})
