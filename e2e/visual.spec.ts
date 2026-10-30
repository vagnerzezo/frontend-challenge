import { addToCartFromDetail, expect, login, test, useMockConfig } from './fixtures'
import type { Page } from '@playwright/test'

/** Regressão visual com dados estáveis (fixtures determinísticas, latência zero). */
async function stabilize(page: Page) {
  await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important}' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForLoadState('networkidle')
  // rola a página para disparar imagens lazy e aguarda as visíveis carregarem
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 30))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForFunction(() => [...document.images].filter((i) => i.offsetParent !== null).every((i) => i.complete))
}

test.describe('Regressão visual', () => {
  test.beforeEach(async ({ page }) => useMockConfig(page))

  test('início', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#catalogo [data-testid=nft-card]')).toHaveCount(9)
    await stabilize(page)
    await expect(page).toHaveScreenshot('inicio.png', { fullPage: true })
  })

  test('detalhe', async ({ page }) => {
    await page.goto('/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await stabilize(page)
    await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true })
  })

  test('carrinho', async ({ page }) => {
    await addToCartFromDetail(page, 'emerald-ape-042', 2)
    await addToCartFromDetail(page, 'violet-nomad-314', 1)
    await expect(page.getByTestId('order-summary')).toContainText('3.786 ETH')
    await stabilize(page)
    await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true })
  })

  test('pagamento', async ({ page }) => {
    await login(page)
    await addToCartFromDetail(page, 'emerald-ape-042', 2)
    await page.goto('/pagamento')
    await expect(page.getByTestId('order-summary')).toContainText('2.396 ETH')
    await expect(page.getByLabel('Endereço da carteira')).not.toHaveValue('')
    await stabilize(page)
    await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true })
  })
})
