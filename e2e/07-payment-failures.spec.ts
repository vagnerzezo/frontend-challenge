import { addToCartFromDetail, expect, login, mocks, test, useScenario, waitForSocket } from './fixtures'
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

test.describe('7. Falha de pagamento, clique repetido e timeout', () => {
  test('pagamento recusado preserva os itens e permite nova tentativa', async ({ page }) => {
    await useScenario(page, { scenario: 'payment-declined' })
    await login(page)
    await addToCartFromDetail(page, 'emerald-ape-042', 1)
    const dialog = await toReview(page)
    await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(dialog.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible({ timeout: 10_000 })
    await expect(dialog).toContainText('Seus itens continuam no carrinho.')
    await dialog.getByRole('link', { name: 'Ver carrinho' }).click()
    await expect(page.getByTestId(/^cart-line/).filter({ visible: true })).toHaveCount(1)
  })

  test('cliques repetidos criam um único pedido', async ({ page }) => {
    await useScenario(page)
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

  test('timeout após criação recupera o mesmo pedido pela chave de idempotência', async ({ page }) => {
    await page.clock.install()
    await useScenario(page, { scenario: 'order-timeout', orderResolutionMs: 16_000 })
    await login(page)
    await addToCartFromDetail(page, 'golden-beat-207', 1)
    const dialog = await toReview(page)
    const posts: Array<{ key: string; status?: number }> = []
    page.on('response', async (r) => {
      if (r.request().method() === 'POST' && r.url().endsWith('/api/orders')) posts.push({ key: r.request().headers()['idempotency-key'], status: r.status() })
    })
    await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(dialog.getByRole('heading', { name: 'Enviando pedido' })).toBeVisible()
    // avança além do timeout do cliente (10s): a 1ª resposta é abandonada
    await page.clock.runFor(10_500)
    await expect(dialog.getByText(/sem criar outra compra/)).toBeVisible()
    await page.clock.runFor(1_500)
    await expect(dialog.getByRole('heading', { name: 'Pagamento pendente' })).toBeVisible()
    const pendingId = (await dialog.getByTestId('pending-order-id').textContent())!.match(/ord_\w+/)![0]
    await page.clock.runFor(5_000)
    await expect(page).toHaveURL(new RegExp(`/pedido/${pendingId}$`), { timeout: 10_000 })
    // todas as tentativas usaram a mesma chave
    expect(new Set(posts.map((p) => p.key)).size).toBe(1)
    await expect(page.getByTestId('receipt-items')).toContainText('Golden Beat #207')
  })

  test('recusa de conexão da carteira é informada', async ({ page }) => {
    await useScenario(page, { scenario: 'wallet-reject' })
    await login(page)
    await addToCartFromDetail(page, 'emerald-ape-042', 1)
    const dialog = await toReview(page)
    await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(dialog.getByText('A conexão foi recusada na carteira.')).toBeVisible()
    await mocks(page).setConfig({ scenario: 'default' })
    await dialog.getByRole('button', { name: 'Revisar novamente' }).click()
    await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(page).toHaveURL(/\/pedido\/ord_/, { timeout: 15_000 })
  })
})
