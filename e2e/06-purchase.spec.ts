import { addToCartFromDetail, expect, isMobile, login, test, useScenario, waitForSocket } from './fixtures'

test.describe('6. Compra completa', () => {
  test('do catálogo ao recibo confirmado', async ({ page }) => {
    await useScenario(page)
    await page.goto('/')
    // catálogo -> detalhe
    await page.getByRole('link', { name: 'Emerald Ape #042' }).first().click()
    await expect(page).toHaveURL(/\/nft\/emerald-ape-042$/)
    await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()

    await addToCartFromDetail(page, 'emerald-ape-042', 2)
    await expect(page.getByTestId('order-summary')).toContainText('2.38 ETH')
    await expect(page.getByTestId('order-summary')).toContainText('2.396 ETH')

    // checkout exige autenticação e retorna ao fluxo
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fpagamento/)
    await page.getByPlaceholder('contato@email.com').fill('colecionador@kurio.dev')
    await page.getByPlaceholder('Senha').fill('Kurio@2026')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/pagamento$/)
    await waitForSocket(page)

    // carrinho do visitante preservado ao autenticar
    await expect(page.getByTestId('order-summary')).toContainText('2.396 ETH')
    await expect(page.getByLabel('Endereço da carteira')).toHaveValue(/^0xA91F/)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()

    const dialog = page.getByTestId('checkout-dialog')
    await expect(dialog.getByRole('heading', { name: 'Revise seu pedido' })).toBeVisible()
    await expect(dialog.getByTestId('review-total')).toHaveText('2.396 ETH')
    await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(dialog.getByRole('heading', { name: 'Pagamento pendente' })).toBeVisible()

    // confirmação via Socket.IO (order.updated) => recibo
    await expect(page).toHaveURL(/\/pedido\/ord_/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
    await expect(page.getByTestId('receipt-items')).toContainText('Emerald Ape #042')
    await expect(page.getByTestId('receipt-items')).toContainText('(x 2)')
    await expect(page.getByTestId('receipt-total')).toHaveText('2.396 ETH')
    await expect(page.getByTestId('tx-id')).toHaveText(/^0x[0-9a-f]{4}…[0-9a-f]{4}$/)

    // itens comprados removidos do carrinho
    if (isMobile(page)) await page.goto('/carrinho')
    else await page.getByRole('link', { name: /^Carrinho/ }).click()
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  })

  test('recibo reproduz o snapshot mesmo após mudança de preço no catálogo', async ({ page }) => {
    await useScenario(page)
    await login(page)
    await addToCartFromDetail(page, 'sage-nomad-009', 1)
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await page.getByTestId('checkout-dialog').getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(page).toHaveURL(/\/pedido\/ord_/, { timeout: 15_000 })
    await expect(page.getByTestId('receipt-total')).toHaveText('1.706 ETH')
    await page.evaluate(() => window.__kurio!.updateNft('sage-nomad-009', { price: '9.99' }))
    await page.reload()
    await expect(page.getByTestId('receipt-total')).toHaveText('1.706 ETH')
    await expect(page.getByTestId('receipt-items')).toContainText('1.69 ETH')
  })
})
