// Configuração da simulação (cenário + condições de rede).
// Fica salva no localStorage e pode ser trocada pela URL (?scenario=<id>),
// pelo painel de cenários ou por window.__kurio.

export const SCENARIOS = {
  default: 'Padrão: catálogo completo, pagamento confirmado após ~3s',
  'empty-catalog': 'Catálogo sem resultados',
  'catalog-error': 'Cada consulta ao catálogo falha 3 vezes (HTTP 503) e depois se recupera',
  'out-of-order': 'Respostas do catálogo chegam fora de ordem (as mais antigas por último)',
  'favorites-error': 'Inclusão/remoção de favoritos falha com HTTP 500',
  'short-session': 'Sessão expira 45s após o login',
  'price-change-on-checkout': 'Preço do 1º item do carrinho sobe 2s após a cotação no pagamento',
  'sold-out-on-checkout': 'Edição do 1º item esgota ao criar o pedido',
  'order-timeout': 'Criação do pedido responde após o timeout do cliente (recuperação por idempotência)',
  'payment-declined': 'Pagamento recusado pela rede',
  'wallet-reject': 'Usuário recusa a conexão da carteira',
} as const

export type ScenarioId = keyof typeof SCENARIOS

export const LATENCY_PROFILES = {
  none: 'Sem latência',
  fast: 'Rápida (120–350ms)',
  slow: 'Lenta (2.5s)',
  variable: 'Variável (100ms–2s, determinística)',
} as const

export type LatencyProfile = keyof typeof LATENCY_PROFILES

export interface MockConfig {
  scenario: ScenarioId
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
  scenario: 'default',
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

  const config = { ...DEFAULT_CONFIG, ...saved }
  const scenarioFromUrl = new URLSearchParams(location.search).get('scenario')
  if (scenarioFromUrl && scenarioFromUrl in SCENARIOS) config.scenario = scenarioFromUrl as ScenarioId
  if (!(config.scenario in SCENARIOS)) config.scenario = 'default'
  return config
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
