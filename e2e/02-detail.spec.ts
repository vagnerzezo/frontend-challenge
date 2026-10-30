import { expect, isMobile, test, useScenario } from './fixtures'

test.describe('2. Detalhe: acesso direto e recurso inexistente', () => {
  test.beforeEach(async ({ page }) => useScenario(page))

  test('acesso direto ao detalhe carrega dados da API', async ({ page }) => {
    const res = page.waitForResponse((r) => r.url().endsWith('/api/nfts/emerald-ape-042'))
    await page.goto('/nft/emerald-ape-042')
    expect((await res).status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page.getByText('ID do token: #0042')).toBeVisible()
    await expect(page).toHaveTitle('Emerald Ape #042 — Kurio')
  })

  test('NFT inexistente exibe estado de não encontrado', async ({ page }) => {
    await page.goto('/nft/nao-existe-999')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    await page.getByRole('link', { name: 'Explorar o mercado' }).click()
    await expect(page).toHaveURL(/\/#catalogo$|\/$/)
  })

  test('rota inexistente exibe 404', async ({ page }) => {
    await page.goto('/rota/que/nao/existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })

  test('edição indisponível e limite de quantidade', async ({ page }) => {
    await page.goto('/nft/emerald-ape-042')
    // 1/1 esgotada nas fixtures (índice 0)
    await expect(page.getByRole('button', { name: 'Edição 1/1, esgotada' })).toBeDisabled()
    await page.getByRole('button', { name: /^Edição 1\/10/ }).click()
    const hint = await page.getByText(/disponível\(is\) nesta edição/).textContent()
    const available = Number(hint!.match(/^(\d+)/)![1])
    const inc = page.getByRole('button', { name: 'Aumentar quantidade' }).filter({ visible: true })
    for (let i = 1; i < available; i++) await inc.click()
    await expect(inc).toBeDisabled()
    const qty = page.getByRole('group', { name: 'Quantidade' }).filter({ visible: true }).locator('output')
    await expect(qty).toHaveText(String(available))

    // esgotar a edição no "servidor" atualiza o detalhe via Socket.IO
    await page.evaluate(() => window.__kurio!.updateNft('emerald-ape-042', { editions: { '1-10': 0 } }))
    await expect(page.getByRole('button', { name: 'Edição 1/10, esgotada' })).toBeDisabled()
    const buy = isMobile(page) ? page.getByRole('button', { name: 'Comprar NFT', exact: true }) : page.getByRole('button', { name: 'COMPRAR', exact: true })
    await page.getByRole('button', { name: /^Edição 1\/50/ }).click()
    await expect(buy).toBeEnabled()
  })
})
