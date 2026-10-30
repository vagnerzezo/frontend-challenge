import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { db } from './db'
import { resumePendingOrders } from './domain'
import { getConfig, SCENARIOS, LATENCY_PROFILES } from './config'

// Liga a API simulada (MSW). Só é usado quando VITE_ENABLE_MOCKS=true.
export async function startMocks() {
  await db.init()
  const worker = setupWorker(...handlers)
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
    serviceWorker: { url: '/mockServiceWorker.js' },
  })
  resumePendingOrders()

  // funções usadas pelos testes e pelo painel de cenários (chamam as rotas /__mock)
  const callMock = async (path: string, method = 'POST', body?: unknown) => {
    const response = await fetch(`/__mock${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return response.json()
  }
  window.__kurio = {
    scenarios: SCENARIOS,
    latencies: LATENCY_PROFILES,
    config: () => getConfig(),
    state: () => callMock('/state', 'GET'),
    setConfig: (patch) => callMock('/config', 'PUT', patch),
    reset: () => callMock('/reset'),
    updateNft: (id, patch) => callMock(`/nfts/${id}`, 'PATCH', patch),
    replayEvent: (mode, resourceId) => callMock('/events/replay', 'POST', { mode, resourceId }),
    dropSocket: (holdMs = 0) => callMock('/socket/drop', 'POST', { holdMs }),
    expireSessions: () => callMock('/sessions/expire'),
    disconnectWallets: () => callMock('/wallet-sessions/disconnect'),
    resolveOrder: (id) => callMock(`/orders/${id}/resolve`),
  }
}

declare global {
  interface Window {
    __kurio?: {
      scenarios: typeof SCENARIOS
      latencies: typeof LATENCY_PROFILES
      config: () => ReturnType<typeof getConfig>
      state: () => Promise<unknown>
      setConfig: (patch: Partial<ReturnType<typeof getConfig>>) => Promise<unknown>
      reset: () => Promise<unknown>
      updateNft: (id: string, patch: { price?: string; editions?: Record<string, number> }) => Promise<unknown>
      replayEvent: (mode: 'duplicate' | 'stale', resourceId?: string) => Promise<{ sent: boolean }>
      dropSocket: (holdMs?: number) => Promise<unknown>
      expireSessions: () => Promise<unknown>
      disconnectWallets: () => Promise<unknown>
      resolveOrder: (id: string) => Promise<unknown>
    }
  }
}
