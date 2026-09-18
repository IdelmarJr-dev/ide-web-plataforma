import { expect, test } from '@playwright/test'
import {
  atributo,
  documentoConceitual,
  entidade,
  exercicio,
  participacao,
  relacionamento,
  simularApi,
} from './apiSimulada'

// cliente (1,1) —faz— (0,n) pedido: todo pedido é de um cliente.
const CLIENTE_FAZ_PEDIDO = documentoConceitual(
  [
    entidade('e-cliente', 'cliente', 0, 0),
    atributo('a-cliente', 'codigo', 'e-cliente', { chave: true, x: -60, y: -120 }),
    entidade('e-pedido', 'pedido', 360, 0),
    atributo('a-pedido', 'numero', 'e-pedido', { chave: true, x: 420, y: -120 }),
    relacionamento('r-faz', 'faz', 180, 160),
  ],
  [participacao('p1', 'r-faz', 'e-cliente', 1, '1'), participacao('p2', 'r-faz', 'e-pedido', 0, 'n')],
)

test('converte o conceitual em tabelas, libera a aba Lógico e avisa quando o conceitual muda', async ({ page }) => {
  const api = await simularApi(page, {
    exercicio: exercicio({ modoMer: 'conceitual_logico', temSql: false }),
    diagrama: CLIENTE_FAZ_PEDIDO,
  })
  await page.goto('/exercicios/e1')

  const abaLogico = page.getByRole('tab', { name: '2. Lógico' })
  await expect(page.locator('[data-testid="entidade-node"]').first()).toBeVisible()
  await expect(abaLogico).toBeDisabled()

  await page.getByRole('button', { name: 'Converter para lógico →' }).click()
  const assistente = page.getByRole('dialog')
  await expect(assistente).toContainText('não tem nenhuma decisão em aberto')
  await expect(assistente).toContainText('Resultado: 2 tabelas')
  await assistente.getByRole('button', { name: 'Converter' }).click()

  // Foi para a aba Lógico com as duas tabelas e a FK criada pela regra 1:N.
  await expect(abaLogico).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: 'Coluna cliente_codigo de pedido' })).toBeVisible()
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)

  await expect(page.getByText(/Salvo às \d{2}:\d{2}/)).toBeVisible({ timeout: 10_000 })
  const salvo = JSON.stringify(api.salvamentos.at(-1))
  expect(salvo).toContain('"assinaturaConceitual"')
  expect(salvo).toContain('cliente_codigo')

  // Mexer no conceitual depois de converter dispara o aviso.
  await page.getByRole('tab', { name: '1. Conceitual' }).click()
  await page.locator('[data-testid="entidade-node"]').first().dblclick()
  await page.getByLabel('Nome da entidade').fill('freguês')
  await page.keyboard.press('Enter')

  await expect(page.getByText('O modelo conceitual mudou depois da última conversão.')).toBeVisible()
  await page.screenshot({ path: 'test-results/modelagem-conversao.png' })
})

// usuario (1,1) —possui— (1,1) perfil: as duas participações obrigatórias liberam "fundir".
const USUARIO_POSSUI_PERFIL = documentoConceitual(
  [
    entidade('e-usuario', 'usuario', 0, 0),
    atributo('a-usuario', 'login', 'e-usuario', { chave: true, x: -60, y: -120 }),
    entidade('e-perfil', 'perfil', 360, 0),
    atributo('a-perfil', 'id', 'e-perfil', { chave: true, x: 420, y: -120 }),
    relacionamento('r-possui', 'possui', 180, 160),
  ],
  [participacao('p1', 'r-possui', 'e-usuario', 1, '1'), participacao('p2', 'r-possui', 'e-perfil', 1, '1')],
)

test('assistente pergunta o que fazer com o 1:1 e a escolha muda o resultado', async ({ page }) => {
  await simularApi(page, {
    exercicio: exercicio({ modoMer: 'conceitual_logico', temSql: false }),
    diagrama: USUARIO_POSSUI_PERFIL,
  })
  await page.goto('/exercicios/e1')
  await expect(page.locator('[data-testid="relacionamento-node"]')).toBeVisible()

  await page.getByRole('button', { name: 'Converter para lógico →' }).click()
  const assistente = page.getByRole('dialog')
  await expect(assistente).toContainText('possui — usuario / perfil')

  // Padrão pré-marcado: chave estrangeira no lado obrigatório, com as duas tabelas.
  await expect(assistente.getByRole('radio', { name: /Chave estrangeira no lado obrigatório/ })).toBeChecked()
  await expect(assistente).toContainText('Resultado: 2 tabelas')

  await assistente.getByRole('radio', { name: /Fundir as duas entidades/ }).check()
  await expect(assistente).toContainText('Resultado: 1 tabela')
  await page.screenshot({ path: 'test-results/assistente-conversao.png' })
  await assistente.getByRole('button', { name: 'Converter' }).click()

  await expect(page.getByRole('button', { name: 'Coluna login de usuario' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Coluna id de usuario' })).toBeVisible()
  await expect(page.locator('[data-testid="tabela-node"]')).toHaveCount(1)
})
