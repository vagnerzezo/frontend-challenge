import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

/**
 * E2E com MSW ativo no build otimizado (vite build + preview).
 * Cada teste usa um BrowserContext novo => localStorage vazio => "banco" simulado
 * semeado do zero (estado isolado e determinístico).
 */
export default defineConfig({
  testDir: './e2e',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',
  timeout: 45_000,
  expect: { timeout: 8_000, toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' } },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, browserName: 'chromium' },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { VITE_ENABLE_MOCKS: 'true', VITE_MOCK_LATENCY: 'none' },
  },
})
