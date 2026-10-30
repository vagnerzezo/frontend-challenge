// Contratos REST e de eventos compartilhados entre cliente (Axios/Query/UI)
// e camada de mocks (MSW). Valores em ETH trafegam SEMPRE como string decimal.

export type EthString = string
export type ISODate = string

// Erros

export type ApiErrorCode =
  | 'VALIDATION_ERROR' // 422
  | 'UNAUTHENTICATED' // 401 - sem sessão
  | 'SESSION_EXPIRED' // 401 - sessão expirada
  | 'INVALID_CREDENTIALS' // 401 - login
  | 'FORBIDDEN' // 403
  | 'NOT_FOUND' // 404
  | 'CONFLICT' // 409 genérico (ex.: e-mail/usuário já cadastrado)
  | 'AVAILABILITY_CONFLICT' // 409 - edição esgotada / quantidade acima do disponível
  | 'QUOTE_STALE' // 409 - cotação desatualizada
  | 'IDEMPOTENCY_CONFLICT' // 409 - chave reutilizada com conteúdo diferente
  | 'COUPON_INVALID' // 422
  | 'COUPON_EXPIRED' // 422
  | 'WALLET_REJECTED' // 403 - usuário recusou conexão
  | 'WALLET_DISCONNECTED' // 409 - sessão de carteira encerrada
  | 'TRANSIENT' // 503 - falha transitória
  | 'INTERNAL' // 500

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    // erros de campo: nome do campo -> mensagem
    fields?: Record<string, string>
    details?: Record<string, unknown>
  }
}

// Sessão e conta

export interface User {
  id: string
  username: string
  email: string
  displayName: string
  avatarUrl: string | null
}

export interface Session {
  token: string
  user: User
  expiresAt: ISODate
}

export interface LoginRequest {
  email: string
  password: string
  // carrinho do visitante para mesclar ao autenticar
  guestCartId?: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  guestCartId?: string
}

// NFTs

export type Network = 'ethereum' | 'polygon' | 'solana'
export type CollectionSlug =
  | 'arte-digital'
  | 'fotografia'
  | 'musica'
  | 'arte-3d'
  | 'colecionaveis'
  | 'generativa'
  | 'jogos'
  | 'assinaturas'
  | 'utilidade'

export type CatalogTab = 'todos' | 'novos' | 'em-alta'
export type CatalogSort = 'recentes' | 'preco-asc' | 'preco-desc' | 'nome'

export interface Edition {
  id: string // ex.: "1-50"
  label: string // ex.: "1/50"
  supply: number | null // null = aberta
  available: number
  price: EthString
}

export interface NftSummary {
  id: string
  name: string
  tokenId: string
  image: string
  price: EthString // menor preço entre edições disponíveis
  previousPrice: EthString | null
  rare: boolean
  network: Network
  collection: CollectionSlug
  available: number
  version: number
}

export interface Nft extends NftSummary {
  collectionName: string
  description: string
  longDescription: string[]
  attributes: string[]
  gallery: string[]
  rating: number
  reviewsCount: number
  contract: string
  royalties: string
  editions: Edition[]
  reviews: Review[]
  createdAt: ISODate
}

export interface Review {
  author: string
  rating: number
  text: string
}

export interface NftListParams {
  q?: string
  collections?: CollectionSlug[]
  networks?: Network[]
  minPrice?: string
  maxPrice?: string
  tab?: CatalogTab
  sort?: CatalogSort
  page?: number
  pageSize?: number
}

export interface Facet<T extends string> {
  value: T
  label: string
  count: number
}

export interface NftListResponse {
  items: NftSummary[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  facets: {
    collections: Facet<CollectionSlug>[]
    networks: Facet<Network>[]
    priceRange: { min: EthString; max: EthString }
  }
  // eco dos parâmetros efetivamente aplicados pela API
  applied: NftListParams
}

// Favoritos

export interface FavoritesResponse {
  nftIds: string[]
}

// Carrinho

export interface CartItemInput {
  nftId: string
  editionId: string
  quantity: number
}

export interface CartLine {
  nftId: string
  editionId: string
  editionLabel: string
  name: string
  tokenId: string
  image: string
  quantity: number
  unitPrice: EthString
  lineTotal: EthString
  available: number
  nftVersion: number
  // preço registrado quando o item entrou/foi revisado no carrinho
  priceWhenAdded: EthString
}

export interface Cart {
  id: string
  owner: 'guest' | 'user'
  items: CartLine[]
  updatedAt: ISODate
}

// Cotação

export interface QuoteRequest {
  items: CartItemInput[]
  couponCode?: string | null
}

export interface QuoteLine extends CartItemInput {
  name: string
  tokenId: string
  image: string
  editionLabel: string
  unitPrice: EthString
  lineTotal: EthString
  available: number
}

export interface Quote {
  id: string
  items: QuoteLine[]
  coupon: { code: string; percentOff: number } | null
  subtotal: EthString
  discount: EthString
  networkFee: EthString
  total: EthString
  // hash determinístico de preços/quantidades/cupom/taxa
  fingerprint: string
  createdAt: ISODate
  expiresAt: ISODate
}

// Carteiras

export type WalletProvider = 'metamask' | 'walletconnect' | 'coinbase'
export type WalletSlot = 'primary' | 'secondary'

export interface WalletInput {
  displayName: string
  nickname: string
  network: Network
  profileName: string
  address: string
  secondaryAddress?: string
  provider: WalletProvider
  referralCode: string
  email: string
  ensName: string
}

export interface Wallet extends WalletInput {
  id: string
  slot: WalletSlot
  updatedAt: ISODate
}

export interface WalletSession {
  id: string
  walletId: string
  network: Network
  provider: WalletProvider
  status: 'connected' | 'disconnected'
}

// Pedidos

export type OrderStatus = 'pending' | 'confirmed' | 'rejected'

export interface BuyerInfo {
  displayName: string
  username: string
  profileName: string
  email: string
  referralCode: string
  ensName: string
  note?: string
}

export interface CreateOrderRequest {
  quoteId: string
  quoteFingerprint: string
  walletSessionId: string
  buyer: BuyerInfo
}

export interface Order {
  id: string
  status: OrderStatus
  version: number
  idempotencyKey: string
  // snapshot imutável no momento da criação
  items: QuoteLine[]
  subtotal: EthString
  discount: EthString
  networkFee: EthString
  total: EthString
  coupon: Quote['coupon']
  wallet: { provider: WalletProvider; address: string; network: Network; label: string }
  transactionHash: string | null
  explorerUrl: string | null
  failureReason: string | null
  createdAt: ISODate
  updatedAt: ISODate
}

// Perfil

export interface Profile extends User {
  walletNickname: string
  ensName: string
}

export interface ProfileUpdate {
  displayName: string
  username: string
  email: string
  walletNickname: string
  ensName: string
}

export interface PasswordChange {
  currentPassword: string
  newPassword: string
}

// Eventos Socket.IO

export interface RealtimeEnvelope<TType extends string, TPayload> {
  // identidade estável do evento (deduplicação)
  eventId: string
  type: TType
  resource: { type: 'nft' | 'order'; id: string }
  // versão do recurso após a mudança (ordenação)
  version: number
  occurredAt: ISODate
  payload: TPayload
}

export type NftUpdatedEvent = RealtimeEnvelope<
  'nft.updated',
  { price: EthString; previousPrice: EthString | null; available: number; editions: Edition[] }
>

export type OrderUpdatedEvent = RealtimeEnvelope<'order.updated', { status: OrderStatus; order: Order }>

export interface SocketServerToClient {
  'nft.updated': (event: NftUpdatedEvent) => void
  'order.updated': (event: OrderUpdatedEvent) => void
  'session.joined': (info: { userId: string | null }) => void
}

export interface SocketClientToServer {
  'session.join': (info: { token: string | null }) => void
}
