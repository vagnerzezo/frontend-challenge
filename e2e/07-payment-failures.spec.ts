import { addToCartFromDetail, expect, login, test, useMockConfig, waitForSocket } from './fixtures'
import type { Page } from '@playwright/test'

async function toReview(page: Page) {
  await page.goto('/pagamento')
  await waitForSocket(page)
  await expect(page.getByTestId('order-summary')).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  const dialog = page.getByTestId('checkout-dialog')
  await expect(dialog.getByTestId('review-total')).toBeVisible()
  return dialog
}

test.describe('7. Clique repetido no pagamento', () => {
  test('cliques repetidos criam um único pedido', async ({ page }) => {
    await useMockConfig(page)
    await login(page)
    await addToCartFromDetail(page, 'sage-nomad-009', 1)
    const dialog = await toReview(page)
    const orderPosts: string[] = []
    page.on('request', (r) => r.method() === 'POST' && r.url().endsWith('/api/orders') && orderPosts.push(r.headers()['idempotency-key']))
    const pay = dialog.getByRole('button', { name: 'Confirmar e pagar' })
    await pay.dblclick().catch(() => undefined)
    await pay.click({ timeout: 500 }).catch(() => undefined)
    await expect(page).toHaveURL(/\/pedido\/ord_/, { timeout: 15_000 })
    expect(new Set(orderPosts).size).toBe(1)
  })
})
