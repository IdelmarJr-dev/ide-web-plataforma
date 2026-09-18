import { expect, test } from '@playwright/test'
import { atributo, coluna, documentoConceitual, documentoLogico, entidade, exercicio, simularApi } from './apiSimulada'

const PROFESSOR = { id: 'p1', nome: 'Ana Lima', email: 'ana@ifpi.edu.br', papel: 'professor', turmaId: null }

// O aluno entregou o conceitual; o gabarito do professor está no lógico.
const ENTREGA_DO_ALUNO = documentoConceitual(
  [entidade('e-cliente', 'cliente', 0, 0), atributo('a-codigo', 'codigo', 'e-cliente', { chave: true, x: -80, y: -140 })],
  [],
)
const GABARITO = documentoLogico([
  { id: 't-cliente', posicao: { x: 0, y: 0 }, nome: 'cliente', colunas: [coluna('c-codigo', 'codigo', { pk: true, notNull: true })] },
])

test('professor lê o modelo entregue pelo aluno e compara com o gabarito', async ({ page }) => {
  await simularApi(page, {
    usuario: PROFESSOR,
    exercicio: exercicio({ modoMer: 'conceitual_logico', temSql: false, merGabarito: GABARITO }),
    diagramaDoAluno: ENTREGA_DO_ALUNO,
  })
  await page.goto('/admin/turmas/t1/exercicios/e1/revisar/u1')

  const modelagem = page.getByRole('region', { name: 'Modelagem do aluno' })
  await expect(modelagem).toBeVisible()
  await expect(page.locator('[data-testid="entidade-node"]')).toHaveCount(1)

  // Leitura: nada de paleta nem de edição no modelo do aluno.
  await expect(modelagem.getByRole('button', { name: 'Entidade' })).toHaveCount(0)

  await modelagem.getByRole('tab', { name: 'Gabarito' }).click()
  await expect(page.locator('[data-testid="tabela-node"]')).toHaveCount(1)
  await page.screenshot({ path: 'test-results/revisao-modelagem.png' })

  // O formulário de nota continua embaixo.
  // Fase 10, D6: a escala do IFPI é 0,0 a 10,0.
  await expect(page.getByLabel(/Avaliação do diagrama MER/)).toBeVisible()
})
