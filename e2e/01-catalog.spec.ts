import { expect, isMobile, test, useScenario } from './fixtures'
import type { Page } from '@playwright/test'

/** No mobile os filtros ficam em um drawer (Sheet). */
async function openFilters(page: Page) {
  if (isMobile(page)) await page.getByRole('button', { name: /^Filtros/ }).click()
  return isMobile(page) ? page.getByRole('dialog') : page.getByRole('complementary', { name: 'Filtros do catálogo' })
}
async function closeFilters(page: Page) {
  if (isMobile(page)) await page.getByRole('button', { name: 'Ver resultados' }).click()
}
const cards = (page: Page) => page.locator('#catalogo [data-testid=nft-card]')

test.describe('1. Catálogo: busca, filtros, ordenação, paginação e histórico', () => {
  test.beforeEach(async ({ page }) => useScenario(page))

  test('busca reflete na URL e na API', async ({ page }) => {
    await page.goto('/')
    const req = page.waitForRequest((r) => r.url().includes('/api/nfts?') && r.url().includes('q=golden'))
    if (isMobile(page)) {
      await page.getByRole('searchbox', { name: 'Buscar no catálogo' }).fill('golden')
    } else {
      await page.getByRole('button', { name: 'Buscar NFTs' }).click()
      await page.getByRole('dialog').getByLabel('Termo de busca').fill('golden')
      await page.getByRole('dialog').getByRole('button', { name: 'Buscar' }).click()
    }
    await req
    await expect(page).toHaveURL(/[?&]q=golden/)
    await expect(cards(page)).toHaveCount(3)
    for (const name of await cards(page).getByRole('heading').allTextContents()) expect(name.toLowerCase()).toContain('golden')
  })

  test('filtros combinados, ordenação, paginação e restauração pelo histórico', async ({ page }) => {
    await page.goto('/')
    await expect(cards(page)).toHaveCount(9)

    // página 2 e depois filtro => paginação reinicia
    if (!isMobile(page)) {
      await page.getByRole('link', { name: 'Página 2' }).click()
      await expect(page).toHaveURL(/page=2/)
    }
    let panel = await openFilters(page)
    await panel.getByRole('button', { name: /^Música/ }).click()
    await expect(page).not.toHaveURL(/page=/)
    await expect(page).toHaveURL(/collections=musica/)
    panel = isMobile(page) ? panel : await openFilters(page)
    const apiCall = page.waitForRequest((r) => r.url().includes('collections=musica') && r.url().includes('networks=polygon'))
    await panel.getByRole('button', { name: /^Polygon/ }).click()
    await apiCall
    await expect(page).toHaveURL(/networks=polygon/)
    await closeFilters(page)
    await expect(cards(page).first()).toBeVisible()
    const filteredCount = await cards(page).count()
    expect(filteredCount).toBeGreaterThan(0)
    await expect(page.getByText(/^Golden Beat #207$/)).toBeVisible()

    // ordenação por menor preço
    if (isMobile(page)) {
      await page.goto('/?collections=musica&networks=polygon&sort=preco-asc')
    } else {
      await page.getByRole('combobox', { name: 'Ordenar por:' }).click()
      await page.getByRole('option', { name: 'Menor preço' }).click()
    }
    await expect(page).toHaveURL(/sort=preco-asc/)
    const prices = (await cards(page).locator('p > span.font-bold').allTextContents()).map((t) => parseFloat(t))
    expect(prices).toEqual([...prices].sort((a, b) => a - b))

    // refresh preserva o estado
    await page.reload()
    await expect(page).toHaveURL(/collections=musica/)
    await expect(cards(page)).toHaveCount(filteredCount)

    // histórico: voltar remove a ordenação; avançar restaura
    await page.goBack()
    await expect(page).not.toHaveURL(/sort=/)
    await page.goForward()
    await expect(page).toHaveURL(/sort=preco-asc/)
  })

  test('paginação navega e a URL restaura a página', async ({ page }) => {
    await page.goto('/?page=3')
    await expect(cards(page)).toHaveCount(9)
    const page3 = await cards(page).first().getByRole('heading').textContent()
    if (!isMobile(page)) {
      await expect(page.getByRole('link', { name: 'Página 3' })).toHaveAttribute('aria-current', 'page')
      await page.getByRole('link', { name: 'Próxima página' }).click()
      await expect(page).toHaveURL(/page=4/)
      await page.goBack()
      await expect(page).toHaveURL(/page=3/)
    }
    await expect(cards(page).first().getByRole('heading')).toHaveText(page3!)
  })

  test('resultado vazio com ação de limpar filtros', async ({ page }) => {
    await page.goto('/?q=inexistente-xyz')
    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
    await page.getByRole('status').getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(cards(page)).toHaveCount(9)
  })

  test('respostas fora de ordem não sobrescrevem o resultado mais recente', async ({ page }) => {
    await page.goto('/')
    await expect(cards(page)).toHaveCount(9)
    const firstOfAll = await cards(page).first().getByRole('heading').textContent()
    // a partir daqui, a 1ª consulta responde em 1.8s, a 2ª em 0.6s e a 3ª em 0.2s
    await page.evaluate(() => (window.__kurio as unknown as { setConfig: (c: object) => Promise<unknown> }).setConfig({ scenario: 'out-of-order' }))
    const tabs = page.getByRole('tablist', { name: 'Seleção do catálogo' })
    await tabs.getByRole('tab', { name: 'Novos lançamentos' }).click()
    await tabs.getByRole('tab', { name: 'Em alta' }).click()
    await tabs.getByRole('tab', { name: 'Todos os NFTs' }).click()
    await page.waitForTimeout(2300) // todas as respostas (inclusive as obsoletas) já chegaram
    await expect(tabs.getByRole('tab', { name: 'Todos os NFTs' })).toHaveAttribute('aria-selected', 'true')
    await expect(cards(page)).toHaveCount(9)
    await expect(cards(page).first().getByRole('heading')).toHaveText(firstOfAll!)
  })
})
