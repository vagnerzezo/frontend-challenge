import { expect, login, test, useMockConfig } from './fixtures'

test.describe('4. Favoritos', () => {
  test('exige autenticação', async ({ page }) => {
    await useMockConfig(page)
    await page.goto('/nft/sage-nomad-009')
    await page.getByRole('button', { name: 'Favoritar Sage Nomad #009' }).filter({ visible: true }).first().click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fnft%2Fsage-nomad-009/)
  })

  test('inclusão otimista persiste para o usuário', async ({ page }) => {
    await useMockConfig(page)
    await login(page)
    await page.goto('/nft/sage-nomad-009')
    const fav = page.getByRole('button', { name: /Sage Nomad #009/ }).filter({ visible: true }).and(page.locator('[aria-pressed]')).first()
    await expect(fav).toHaveAttribute('aria-pressed', 'false')
    await fav.click()
    await expect(fav).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page.getByRole('button', { name: 'Remover Sage Nomad #009 dos favoritos' }).filter({ visible: true }).first()).toHaveAttribute('aria-pressed', 'true')
  })
})
