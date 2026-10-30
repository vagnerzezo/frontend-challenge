import { addToCartFromDetail, expect, login, mocks, test, useMockConfig, waitForSocket } from './fixtures'

test.describe('10. Eventos duplicados/antigos, desconexão e retomada de pedido pendente', () => {
  test('duplicatas e eventos antigos não regridem o estado nem reaplicam efeitos', async ({ page }) => {
    await useMockConfig(page)
    await addToCartFromDetail(page, 'golden-signal-160', 1)
    await waitForSocket(page)
    const m = mocks(page)
    await m.updateNft('golden-signal-160', { price: '0.50' }) // v2
    await expect(page.getByTestId('order-summary')).toContainText('0.516 ETH')
    await m.updateNft('golden-signal-160', { price: '0.60' }) // v3
    await expect(page.getByTestId('order-summary')).toContainText('0.616 ETH')
    // após duplicata/evento antigo, nenhum efeito é reaplicado (sem refetch do carrinho/cotação)
    const effects: string[] = []
    page.on('request', (r) => /\/api\/(cart|quotes)$/.test(r.url()) && effects.push(r.url()))
    expect((await m.replayEvent('duplicate', 'golden-signal-160')).sent).toBe(true)
    expect((await m.replayEvent('stale', 'golden-signal-160')).sent).toBe(true) // v2 antigo
    await page.waitForTimeout(800)
    expect(effects).toEqual([])
    await expect(page.getByTestId('order-summary')).toContainText('0.616 ETH')
    await page.goto('/nft/golden-signal-160')
    await expect(page.getByTestId('nft-price')).toContainText('0.60 ETH')
  })

  test('reconexão reconcilia com a API eventos perdidos durante a queda', async ({ page }) => {
    await useMockConfig(page)
    await page.goto('/nft/golden-beat-207')
    await waitForSocket(page)
    await mocks(page).dropSocket(3000)
    await expect(page.getByTestId('realtime-banner')).toBeVisible()
    // mudança enquanto desconectado: evento não é entregue
    await mocks(page).updateNft('golden-beat-207', { price: '2.22' })
    await expect(page.getByTestId('realtime-banner')).toBeHidden({ timeout: 10_000 })
    await expect(page.getByTestId('nft-price')).toContainText('2.22 ETH')
  })

  test('pedido pendente é retomado após refresh e após reconexão, sem nova compra', async ({ page }) => {
    await useMockConfig(page, { orderResolutionMs: 4000 })
    await login(page)
    await addToCartFromDetail(page, 'emerald-ape-042', 1)
    await page.goto('/pagamento')
    await waitForSocket(page)
    let posts = 0
    page.on('request', (r) => r.method() === 'POST' && r.url().endsWith('/api/orders') && posts++)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    const dialog = page.getByTestId('checkout-dialog')
    await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(dialog.getByRole('heading', { name: 'Pagamento pendente' })).toBeVisible()
    const id = (await dialog.getByTestId('pending-order-id').textContent())!.match(/ord_\w+/)![0]

    // refresh durante o pendente
    await page.reload()
    await expect(page.getByTestId('checkout-dialog').getByRole('heading', { name: 'Pagamento pendente' })).toBeVisible()
    // queda da conexão: a confirmação ocorre enquanto desconectado
    await mocks(page).dropSocket(5000)
    await expect(page).toHaveURL(new RegExp(`/pedido/${id}$`), { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
    expect(posts).toBe(1)
  })

  test('eventos de pedido de outro usuário não chegam à sessão atual', async ({ browser }) => {
    const ctxA = await browser.newContext()
    const a = await ctxA.newPage()
    await useMockConfig(a)
    await login(a)
    await addToCartFromDetail(a, 'sage-nomad-009', 1)
    await a.goto('/pagamento')
    await a.getByRole('button', { name: 'Confirmar compra' }).click()
    await a.getByTestId('checkout-dialog').getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(a).toHaveURL(/\/pedido\/(ord_\w+)$/, { timeout: 15_000 })
    const orderUrl = new URL(a.url()).pathname
    // outro usuário tentando acessar o recibo
    await a.getByRole('button', { name: /Fechar recibo/ }).click()
    await a.goto('/perfil')
    await a.getByRole('button', { name: 'Sair' }).click()
    await expect(a.getByText('Você saiu da sua conta.').first()).toBeVisible()
    await login(a, { email: 'segundo@kurio.dev', password: 'Kurio@2026', name: 'Ravi Lemos' })
    await a.goto(orderUrl)
    await expect(a.getByRole('heading', { name: 'Acesso negado' })).toBeVisible()
    await ctxA.close()
  })
})
