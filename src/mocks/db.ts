import type { Nft, Order, Quote, Wallet, WalletSession } from '@/api/contracts'
import { buildCatalog, SEED_FAVORITES, SEED_USERS, SEED_WALLETS } from './fixtures'

// "Banco de dados" da API simulada. Tanto as rotas REST quanto os eventos do
// Socket.IO leem daqui. Fica salvo no localStorage para sobreviver ao refresh.

export interface UserRecord {
  id: string
  username: string
  email: string
  displayName: string
  avatarUrl: string | null
  walletNickname: string
  ensName: string
  passwordHash: string
  salt: string
}

export interface CartRecord {
  id: string
  items: Array<{ nftId: string; editionId: string; quantity: number; priceWhenAdded: string }>
  couponCode: string | null
  updatedAt: string
}

export interface OrderRecord extends Order {
  userId: string
  requestHash: string
  quoteId: string
  resolveAt: number
}

export interface DbState {
  version: 1
  seq: number
  nfts: Record<string, Nft>
  nftOrder: string[]
  users: Record<string, UserRecord>
  sessions: Record<string, { userId: string; expiresAt: number }>
  favorites: Record<string, string[]>
  carts: Record<string, CartRecord>
  wallets: Record<string, Wallet & { userId: string }>
  walletSessions: Record<string, WalletSession & { userId: string; address: string }>
  quotes: Record<string, Quote & { ownerKey: string }>
  orders: Record<string, OrderRecord>
  // idempotência: `${userId}:${key}` -> orderId
  idempotency: Record<string, string>
}

export const DB_KEY = 'kurio.mock.db.v1'

export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = Array.from(new Uint8Array(digest))
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

// cria o banco com os dados iniciais
async function createInitialState(): Promise<DbState> {
  const catalog = buildCatalog()
  const users: Record<string, UserRecord> = {}
  for (const seedUser of SEED_USERS) {
    const salt = `seed-${seedUser.id}`
    users[seedUser.id] = {
      id: seedUser.id,
      username: seedUser.username,
      email: seedUser.email,
      displayName: seedUser.displayName,
      avatarUrl: null,
      walletNickname: seedUser.walletNickname,
      ensName: seedUser.ensName,
      salt,
      passwordHash: await hashPassword(seedUser.password, salt),
    }
  }
  return {
    version: 1,
    seq: 1000,
    nfts: Object.fromEntries(catalog.map((nft) => [nft.id, nft])),
    nftOrder: catalog.map((nft) => nft.id),
    users,
    sessions: {},
    favorites: structuredClone(SEED_FAVORITES),
    carts: {},
    wallets: Object.fromEntries(SEED_WALLETS.map((wallet) => [wallet.id, structuredClone(wallet)])),
    walletSessions: {},
    quotes: {},
    orders: {},
    idempotency: {},
  }
}

let state: DbState

export const db = {
  get state(): DbState {
    return state
  },
  async init() {
    try {
      const saved = localStorage.getItem(DB_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as DbState
        if (parsed.version === 1) {
          state = parsed
          return
        }
      }
    } catch {
      // dado salvo inválido, cria de novo
    }
    state = await createInitialState()
    db.save()
  },
  // volta tudo para os dados iniciais
  async reset() {
    state = await createInitialState()
    db.save()
  },
  save() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(state))
    } catch {
      // sem espaço ou modo privado: continua só em memória
    }
  },
  nextId(prefix: string) {
    state.seq += 1
    return `${prefix}_${state.seq.toString(36)}`
  },
}
