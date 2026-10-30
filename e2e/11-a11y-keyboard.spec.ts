import { addToCartFromDetail, expect, isMobile, login, test, useScenario } from './fixtures'

test.describe('11. Teclado, foco em diálogos e validação de formulários', () => {
  test.beforeEach(async ({ page }) => useScenario(page))

  test('link de pular conteúdo e navegação por teclado até o detalhe', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid=nft-card]').first()).toBeVisible()
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#conteudo')).toBeFocused()
    // tabula até o primeiro card e abre o detalhe com Enter
    const first = page.locator('#catalogo [data-testid=nft-card]').first().getByRole('link').first()
    for (let i = 0; i < 60 && !(await first.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
    await expect(first).toBeFocused()
    const outline = await first.evaluate((el) => getComputedStyle(el).outlineStyle + getComputedStyle(el.closest('article')!).outlineStyle)
    expect(outline).toBeTruthy()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/nft\//)
  })

  test('diálogo prende o foco, fecha com Esc e devolve o foco', async ({ page }) => {
    test.skip(isMobile(page), 'busca em diálogo existe apenas no desktop; mobile usa o drawer de filtros')
    await page.goto('/')
    const trigger = page.getByRole('button', { name: 'Buscar NFTs' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Buscar NFTs' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Termo de busca')).toBeFocused()
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('drawer de filtros no mobile controla o foco', async ({ page }) => {
    test.skip(!isMobile(page), 'drawer de filtros é do layout mobile')
    await page.goto('/')
    const trigger = page.getByRole('button', { name: /^Filtros/ })
    await trigger.click()
    const drawer = page.getByRole('dialog', { name: 'Filtros' })
    await expect(drawer).toBeVisible()
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab')
      expect(await drawer.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('validação do checkout com mensagens associadas aos campos', async ({ page }) => {
    await login(page)
    await addToCartFromDetail(page, 'emerald-ape-042', 1)
    await page.goto('/pagamento')
    const email = page.getByRole('textbox', { name: 'E-mail (obrigatório)' })
    await expect(email).toHaveValue('colecionador@kurio.dev')
    await email.fill('invalido')
    await page.getByLabel('Código de indicação').fill('')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    await expect(page.locator(`#${describedBy!.split(' ')[0].replace(/:/g, '\\:')}`)).toHaveText('Informe um e-mail válido.')
    await expect(page.getByText('Código de indicação é obrigatório.')).toBeVisible()
    await expect(page.getByText('Revise os campos destacados antes de confirmar.')).toBeVisible()
    await expect(page.getByTestId('checkout-dialog')).toHaveCount(0)
  })

  test('sem overflow horizontal nas telas principais', async ({ page }) => {
    await login(page)
    await addToCartFromDetail(page, 'emerald-ape-042', 1)
    for (const url of ['/', '/nft/emerald-ape-042', '/carrinho', '/pagamento', '/perfil', '/perfil/carteiras']) {
      await page.goto(url)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `overflow em ${url}`).toBeLessThanOrEqual(0)
    }
  })
})
