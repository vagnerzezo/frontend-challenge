import { test as base, expect, type Page } from '@playwright/test'

export const USERS = {
  nova: { email: 'colecionador@kurio.dev', password: 'Kurio@2026', name: 'Nova Sato' },
  ravi: { email: 'segundo@kurio.dev', password: 'Kurio@2026', name: 'Ravi Lemos' },
} as const

type MockConfig = {
  latency?: 'none' | 'fast' | 'slow' | 'variable'
  offline?: boolean
  serverDown?: boolean
  orderResolutionMs?: number
}

/** Configura a simulação antes do primeiro carregamento (persistida após refresh). */
export async function useMockConfig(page: Page, config: MockConfig = {}) {
  const cfg = { latency: 'none', offline: false, serverDown: false, orderResolutionMs: 1500, ...config }
  await page.addInitScript((c) => {
    if (!localStorage.getItem('kurio.mock.config')) localStorage.setItem('kurio.mock.config', JSON.stringify(c))
  }, cfg)
}

/** Acesso aos controles da simulação (endpoints /__mock via MSW). */
export function mocks(page: Page) {
  const call = async <T,>(fn: string, ...args: unknown[]) => {
    await page.waitForFunction(() => !!window.__kurio)
    return page.evaluate(
      ([name, a]) => (window.__kurio as unknown as Record<string, (...x: unknown[]) => Promise<unknown>>)[name as string](...(a as unknown[])),
      [fn, args] as const,
    ) as Promise<T>
  }
  return {
    setConfig: (patch: MockConfig) => call('setConfig', patch),
    updateNft: (id: string, patch: { price?: string; editions?: Record<string, number> }) => call('updateNft', id, patch),
    replayEvent: (mode: 'duplicate' | 'stale', resourceId?: string) => call<{ sent: boolean }>('replayEvent', mode, resourceId),
    dropSocket: (holdMs = 0) => call('dropSocket', holdMs),
    expireSessions: () => call('expireSessions'),
    disconnectWallets: () => call('disconnectWallets'),
    state: () => call<{ sockets: number }>('state'),
  }
}

export async function waitForApp(page: Page) {
  await page.waitForFunction(() => !!window.__kurio)
}

export async function waitForSocket(page: Page) {
  await expect.poll(async () => (await mocks(page).state()).sockets, { timeout: 10_000 }).toBeGreaterThan(0)
}

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768

export async function login(page: Page, user: (typeof USERS)[keyof typeof USERS] = USERS.nova, redirect?: string) {
  await page.goto(`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`)
  await page.getByPlaceholder('contato@email.com').fill(user.email)
  await page.getByPlaceholder('Senha').fill(user.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText(`Bem-vindo de volta, ${user.name}.`).first()).toBeVisible()
}

/** Adiciona um NFT ao carrinho pela página de detalhe (fluxo real de UI). */
export async function addToCartFromDetail(page: Page, nftId: string, qty = 1, edition = '1/50') {
  await page.goto(`/nft/${nftId}`)
  await page.getByRole('button', { name: new RegExp(`^Edição ${edition.replace('/', '\\/')}`) }).click()
  const inc = page.getByRole('button', { name: 'Aumentar quantidade' }).filter({ visible: true })
  for (let i = 1; i < qty; i++) await inc.click()
  if (isMobile(page)) await page.getByRole('button', { name: 'Comprar NFT', exact: true }).click()
  else await page.getByRole('button', { name: 'COMPRAR', exact: true }).click()
  await expect(page).toHaveURL(/\/carrinho$/)
}

export const test = base
export { expect }
