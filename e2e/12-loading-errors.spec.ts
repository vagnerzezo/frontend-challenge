import { addToCartFromDetail, expect, mocks, test, useScenario } from './fixtures'

test.describe('12. Skeletons, feedback de falha e recuperação', () => {
  test('skeletons com dimensões preservadas durante carregamento lento', async ({ page }) => {
    await useScenario(page, { latency: 'slow' })
    await page.goto('/')
    const skeletons = page.getByTestId('nft-card-skeleton')
    await expect(skeletons.first()).toBeVisible()
    await expect(skeletons).toHaveCount(9)
    const box = await skeletons.first().boundingBox()
    await expect(page.locator('#catalogo [data-testid=nft-card]').first()).toBeVisible({ timeout: 8000 })
    const real = await page.locator('#catalogo [data-testid=nft-card]').first().boundingBox()
    expect(Math.abs(box!.width - real!.width)).toBeLessThan(2)

    await page.goto('/nft/emerald-ape-042')
    await expect(page.getByTestId('nft-detail-skeleton')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible({ timeout: 8000 })
  })

  test('skeleton do resumo do carrinho', async ({ page }) => {
    await useScenario(page)
    await addToCartFromDetail(page, 'emerald-ape-042', 1)
    await mocks(page).setConfig({ latency: 'slow' })
    await page.reload()
    await expect(page.getByTestId('cart-skeleton')).toBeVisible()
    await expect(page.getByTestId('summary-skeleton')).toBeVisible({ timeout: 6000 })
    await expect(page.getByTestId('order-summary')).toBeVisible({ timeout: 8000 })
  })

  test('respeita prefers-reduced-motion nos skeletons', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await useScenario(page, { latency: 'slow' })
    await page.goto('/')
    const anim = await page.getByTestId('nft-card-skeleton').first().locator('.skeleton-shimmer').first().evaluate((el) => getComputedStyle(el).animationName)
    expect(anim).toBe('none')
  })

  test('falha do catálogo exibe erro e recupera com nova tentativa', async ({ page }) => {
    await useScenario(page, { scenario: 'catalog-error' })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Não foi possível carregar o catálogo' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Catálogo temporariamente indisponível.')).toBeVisible()
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.locator('#catalogo [data-testid=nft-card]')).toHaveCount(9)
  })

  test('sem conexão: erro de rede e recuperação', async ({ page }) => {
    await useScenario(page, { offline: true })
    await page.goto('/nft/sage-nomad-009')
    await expect(page.getByText('Sem conexão com o servidor. Verifique sua rede.')).toBeVisible({ timeout: 10_000 })
    await mocks(page).setConfig({ offline: false })
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Sage Nomad #009' })).toBeVisible()
  })
})
