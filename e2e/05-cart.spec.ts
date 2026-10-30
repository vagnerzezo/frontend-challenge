import { addToCartFromDetail, expect, isMobile, login, test, USERS, useScenario } from './fixtures'
import type { Page } from '@playwright/test'

const summary = (page: Page) => page.getByTestId('order-summary')
const line = (page: Page, name: string) =>
  page.getByTestId(/^cart-line/).filter({ visible: true }).filter({ hasText: name })

test.describe('5. Carrinho', () => {
  test.beforeEach(async ({ page }) => useScenario(page))

  test('quantidades, remoção e resumo coerente com a API', async ({ page }) => {
    await addToCartFromDetail(page, 'emerald-ape-042', 1)
    await addToCartFromDetail(page, 'violet-nomad-314', 2)
    await expect(summary(page)).toContainText('3.97 ETH') // 1.19 + 2*1.39
    await line(page, 'Emerald Ape').getByRole('button', { name: /^Aumentar/ }).click()
    await expect(summary(page)).toContainText('5.16 ETH')
    await expect(summary(page)).toContainText('5.176 ETH')
    await line(page, 'Violet Nomad').getByRole('button', { name: /^Remover/ }).click()
    await expect(line(page, 'Violet Nomad')).toHaveCount(0)
    await expect(summary(page)).toContainText('2.38 ETH')
  })

  test('cupom inválido, expirado, válido e remoção', async ({ page }) => {
    await addToCartFromDetail(page, 'ivory-baron-088', 1)
    const input = page.getByLabel('Código promocional')
    const apply = page.getByRole('button', { name: 'Aplicar' })
    await input.fill('NAOEXISTE')
    await apply.click()
    await expect(page.getByText('Código promocional inválido.')).toBeVisible()
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await input.fill('EXPIRADO')
    await apply.click()
    await expect(page.getByText('Este código promocional expirou.')).toBeVisible()
    await input.fill('kurio10')
    await apply.click()
    await expect(page.getByText('Cupom aplicado:')).toBeVisible()
    await expect(summary(page)).toContainText('Desconto (KURIO10, 10%)')
    await expect(summary(page)).toContainText('(-) 0.179') // 10% de 1.79
    await expect(summary(page)).toContainText('1.627 ETH') // 1.79 - 0.179 + 0.016
    await page.reload()
    await expect(summary(page)).toContainText('1.627 ETH')
    await page.getByRole('button', { name: 'Remover', exact: true }).click()
    await expect(summary(page)).toContainText('1.806 ETH')
  })

  test('persistência após refresh e itens do visitante preservados ao autenticar', async ({ page }) => {
    await addToCartFromDetail(page, 'golden-beat-207', 3)
    await page.reload()
    await expect(line(page, 'Golden Beat')).toBeVisible()
    await expect(summary(page)).toContainText('2.97 ETH')
    await login(page, USERS.nova)
    await page.goto('/carrinho')
    await expect(line(page, 'Golden Beat')).toBeVisible()
    await expect(line(page, 'Golden Beat').locator('output')).toHaveText('3')
    // carrinho pertence ao usuário: sobrevive a refresh autenticado
    await page.reload()
    await expect(line(page, 'Golden Beat')).toBeVisible()
    if (!isMobile(page)) await expect(page.getByRole('link', { name: 'Carrinho, 3 itens' })).toBeVisible()
  })

  test('limite de disponibilidade por edição', async ({ page }) => {
    await page.goto('/nft/sage-nomad-009')
    await page.getByRole('button', { name: /^Edição 1\/10/ }).click()
    const available = Number((await page.getByText(/disponível\(is\) nesta edição/).textContent())!.match(/^(\d+)/)![1])
    await addToCartFromDetail(page, 'sage-nomad-009', available, '1/10')
    await expect(line(page, 'Sage Nomad').getByRole('button', { name: /^Aumentar/ })).toBeDisabled()
    await page.goto('/nft/sage-nomad-009')
    await page.getByRole('button', { name: /^Edição 1\/10/ }).click()
    await expect(page.getByText('Você já tem todas as unidades disponíveis desta edição no carrinho.')).toBeVisible()
  })
})
