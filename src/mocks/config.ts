// Configuração da simulação (condições de rede).
// Fica salva no localStorage e pode ser trocada por window.__kurio.

export const LATENCY_PROFILES = {
  none: 'Sem latência',
  fast: 'Rápida (120–350ms)',
  slow: 'Lenta (2.5s)',
  variable: 'Variável (100ms–2s, determinística)',
} as const

export type LatencyProfile = keyof typeof LATENCY_PROFILES

export interface MockConfig {
  latency: LatencyProfile
  // simula ausência de conexão: toda requisição REST falha com erro de rede
  offline: boolean
  // força HTTP 5xx em todas as rotas /api (falha transitória)
  serverDown: boolean
  // atraso (ms) para resolver pedidos pendentes
  orderResolutionMs: number
}

const STORAGE_KEY = 'kurio.mock.config'

const DEFAULT_CONFIG: MockConfig = {
  latency: (import.meta.env.VITE_MOCK_LATENCY as LatencyProfile) || 'fast',
  offline: false,
  serverDown: false,
  orderResolutionMs: 3000,
}

let current: MockConfig = loadConfig()

function loadConfig(): MockConfig {
  let saved: Partial<MockConfig>
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    saved = {}
  }

  return { ...DEFAULT_CONFIG, ...saved }
}

export function getConfig(): MockConfig {
  return current
}

export function setConfig(changes: Partial<MockConfig>): MockConfig {
  current = { ...current, ...changes }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // storage indisponível
  }
  return current
}

export function resetConfig(): MockConfig {
  current = { ...DEFAULT_CONFIG }
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage indisponível
  }
  return current
}
