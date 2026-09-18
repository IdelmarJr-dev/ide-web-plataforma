import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { coluna, documentoLogico, simularApi } from './apiSimulada'

const CLIENTE_E_PEDIDO = documentoLogico([
  {
    id: 't1',
    posicao: { x: 0, y: 0 },
    nome: 'cliente',
    colunas: [coluna('c1', 'id', { pk: true, notNull: true }), coluna('c2', 'nome', { tipo: 'VARCHAR', tamanho: 100 })],
  },
  { id: 't2', posicao: { x: 380, y: 60 }, nome: 'pedido', colunas: [coluna('p1', 'id', { pk: true, notNull: true })] },
])

function sqlDoModelo(page: Page): Locator {
  return page.getByLabel('SQL gerado a partir do modelo')
}

async function arrastar(page: Page, de: Locator, para: Locator): Promise<void> {
  const origem = await de.boundingBox()
  const destino = await para.boundingBox()
  if (!origem || !destino) throw new Error('elemento fora da tela')
  await page.mouse.move(origem.x + origem.width / 2, origem.y + origem.height / 2)
  await page.mouse.down()
  await page.mouse.move(destino.x + destino.width / 2, destino.y + destino.height / 2, { steps: 12 })
  await page.mouse.up()
}

test('liga tabelas por arrasto, gera a FK no SQL, desfaz/refaz e salva sozinho', async ({ page }) => {
  const api = await simularApi(page, { diagrama: CLIENTE_E_PEDIDO })
  await page.goto('/exercicios/e1')

  const tabelaCliente = page.locator('.react-flow__node[data-id="t1"]')
  const tabelaPedido = page.locator('.react-flow__node[data-id="t2"]')
  await expect(tabelaPedido).toBeVisible()
  await expect(sqlDoModelo(page)).toContainText('CREATE TABLE cliente (')

  // Da alça direita de "cliente" até o corpo de "pedido" (fora de qualquer alça).
  await arrastar(page, tabelaCliente.locator('.react-flow__handle-right'), tabelaPedido)

  await expect(sqlDoModelo(page)).toContainText('CONSTRAINT fk_pedido_cliente_id FOREIGN KEY (cliente_id) REFERENCES cliente (id)')
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await expect(page.getByText('(1,1)', { exact: true })).toBeVisible()
  await expect(page.getByText('(0,n)', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(sqlDoModelo(page)).not.toContainText('FOREIGN KEY')
  await page.getByRole('button', { name: 'Refazer' }).click()
  await expect(sqlDoModelo(page)).toContainText('FOREIGN KEY')

  await expect(page.getByText(/Salvo às \d{2}:\d{2}/)).toBeVisible({ timeout: 10_000 })
  const ultimo = JSON.stringify(api.salvamentos.at(-1))
  expect(ultimo).toContain('"fk":{"tabelaId":"t1","colunaId":"c1"}')

  await page.screenshot({ path: 'test-results/modelagem-logica.png' })
})

test('edita coluna no painel e o SQL acompanha; atalhos só valem com foco no desenho', async ({ page }) => {
  await simularApi(page, { diagrama: CLIENTE_E_PEDIDO })
  await page.goto('/exercicios/e1')

  await page.getByRole('button', { name: 'Coluna nome de cliente' }).click()
  const painel = page.getByRole('complementary', { name: 'Propriedades' })
  await painel.getByLabel('Tipo').selectOption('TEXT')
  await painel.getByRole('checkbox', { name: 'NOT NULL' }).check()
  await painel.getByLabel('Restrição de verificação (CHECK)').fill("nome <> ''")

  await expect(sqlDoModelo(page)).toContainText("nome TEXT NOT NULL CHECK (nome <> '')")

  // Delete com foco no campo do painel não apaga a coluna.
  await painel.getByLabel('Restrição de verificação (CHECK)').press('Delete')
  await expect(sqlDoModelo(page)).toContainText('nome TEXT')
})

test('editor SQL ao lado do modelo aceita espaços (regressão do atalho de pan do React Flow)', async ({ page }) => {
  await simularApi(page, { diagrama: CLIENTE_E_PEDIDO })
  await page.goto('/exercicios/e1')
  await expect(page.locator('.react-flow__node[data-id="t1"]')).toBeVisible()

  await page.locator('.monaco-editor .view-lines').click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  await page.keyboard.type('SELECT c.nome FROM cliente c;', { delay: 30 })

  await expect(page.locator('.monaco-editor .view-lines')).toContainText('SELECT c.nome FROM cliente c;')
})
