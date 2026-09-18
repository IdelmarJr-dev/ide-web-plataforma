import { defineConfig } from '@playwright/test'

// Testes de navegador real (docs/decisions/fase7-modelagem-conceitual-logica.md, D13): o jsdom
// não roda React Flow nem Monaco. A API é simulada em cada teste (page.route), então só o
// Vite precisa estar no ar. Usa o Google Chrome instalado na máquina (`channel: 'chrome'`).
const PORTA = 5188

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  // Um worker só: os testes dividem o mesmo Vite, e três páginas pesadas (React Flow +
  // Monaco) subindo juntas travavam o carregamento do exercício.
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${String(PORTA)}`,
    channel: 'chrome',
    viewport: { width: 1366, height: 768 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite --port ${String(PORTA)} --strictPort`,
    url: `http://localhost:${String(PORTA)}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
