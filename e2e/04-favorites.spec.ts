import { expect, login, mocks, test, useScenario } from './fixtures'

test.describe('4. Favoritos', () => {
  test('exige autenticação', async ({ page }) => {
    await useScenario(page)
    await page.goto('/nft/sage-nomad-009')
    await page.getByRole('button', { name: 'Favoritar Sage Nomad #009' }).filter({ visible: true }).first().click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fnft%2Fsage-nomad-009/)
  })

  test('inclusão otimista persiste para o usuário', async ({ page }) => {
    await useScenario(page)
    await login(page)
    await page.goto('/nft/sage-nomad-009')
    const fav = page.getByRole('button', { name: /Sage Nomad #009/ }).filter({ visible: true }).and(page.locator('[aria-pressed]')).first()
    await expect(fav).toHaveAttribute('aria-pressed', 'false')
    await fav.click()
    await expect(fav).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page.getByRole('button', { name: 'Remover Sage Nomad #009 dos favoritos' }).filter({ visible: true }).first()).toHaveAttribute('aria-pressed', 'true')
  })

  test('falha na mutation faz rollback e permite recuperar', async ({ page }) => {
    await useScenario(page)
    await login(page)
    await page.goto('/nft/ivory-baron-088')
    await mocks(page).setConfig({ scenario: 'favorites-error', latency: 'slow' })
    const fav = page.getByRole('button', { name: 'Favoritar Ivory Baron #088' }).filter({ visible: true }).first()
    await fav.click()
    // atualização otimista imediata
    await expect(page.getByRole('button', { name: 'Remover Ivory Baron #088 dos favoritos' }).filter({ visible: true }).first()).toHaveAttribute('aria-pressed', 'true')
    // rollback após a falha + feedback
    await expect(page.getByText(/Não foi possível favoritar Ivory Baron #088/).first()).toBeVisible({ timeout: 6000 })
    await expect(fav).toHaveAttribute('aria-pressed', 'false')

    await mocks(page).setConfig({ scenario: 'default', latency: 'none' })
    await fav.click()
    await expect(page.getByRole('button', { name: 'Remover Ivory Baron #088 dos favoritos' }).filter({ visible: true }).first()).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page.getByRole('button', { name: 'Remover Ivory Baron #088 dos favoritos' }).filter({ visible: true }).first()).toBeVisible()
  })
})
