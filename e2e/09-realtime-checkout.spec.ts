import { addToCartFromDetail, expect, login, mocks, test, useMockConfig, waitForSocket } from './fixtures'

test.describe('9. Alteração de preço/disponibilidade via Socket.IO durante o checkout', () => {
  test('carrinho aberto reflete preço alterado e o checkout exige nova confirmação', async ({ page }) => {
    await useMockConfig(page)
    await login(page)
    await addToCartFromDetail(page, 'emerald-ape-042', 1)
    await waitForSocket(page)
    await expect(page.getByTestId('order-summary')).toContainText('1.206 ETH')

    // 1-3: preço muda durante a navegação => UI informa e atualiza o resumo
    const ws = page.waitForEvent('websocket').catch(() => null)
    void ws
    await mocks(page).updateNft('emerald-ape-042', { price: '1.50' })
    await expect(page.getByText('O preço de Emerald Ape #042 mudou de 1.19 ETH para 1.50 ETH.').first()).toBeVisible()
    await expect(page.getByTestId('price-change-notice')).toBeVisible()
    await expect(page.getByTestId('order-summary')).toContainText('1.516 ETH')

    // 4: no checkout, a revisão é invalidada quando a cotação muda
    await page.goto('/pagamento')
    await waitForSocket(page)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    const dialog = page.getByTestId('checkout-dialog')
    await expect(dialog.getByTestId('review-total')).toHaveText('1.516 ETH')
    await mocks(page).updateNft('emerald-ape-042', { price: '1.70' })
    await expect(dialog.getByTestId('quote-changed')).toBeVisible()
    await expect(dialog.getByTestId('review-total')).toContainText('1.716 ETH')
    await expect(dialog.getByRole('button', { name: 'Confirmar novos valores e pagar' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Confirmar novos valores e pagar' }).click()
    await expect(page).toHaveURL(/\/pedido\/ord_/, { timeout: 15_000 })
    await expect(page.getByTestId('receipt-total')).toHaveText('1.716 ETH')
  })
})
