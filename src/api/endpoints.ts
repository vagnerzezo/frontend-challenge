import { http } from './http'
import type {
  Cart,
  CartItemInput,
  CreateOrderRequest,
  FavoritesResponse,
  LoginRequest,
  Network,
  Nft,
  NftListParams,
  NftListResponse,
  Order,
  PasswordChange,
  Profile,
  ProfileUpdate,
  Quote,
  RegisterRequest,
  Session,
  Wallet,
  WalletInput,
  WalletProvider,
  WalletSession,
  WalletSlot,
} from './contracts'

type RequestOptions = { signal?: AbortSignal }
type CartResponse = Cart & { couponCode: string | null }

function buildListQuery(params: NftListParams) {
  const query: Record<string, string> = {}
  if (params.q) query.q = params.q
  if (params.collections?.length) query.collections = params.collections.join(',')
  if (params.networks?.length) query.networks = params.networks.join(',')
  if (params.minPrice) query.minPrice = params.minPrice
  if (params.maxPrice) query.maxPrice = params.maxPrice
  if (params.tab && params.tab !== 'todos') query.tab = params.tab
  if (params.sort) query.sort = params.sort
  if (params.page) query.page = String(params.page)
  if (params.pageSize) query.pageSize = String(params.pageSize)
  return query
}

export const api = {
  // sessão e conta
  login: (body: LoginRequest) => http.post<Session>('/session', body).then((res) => res.data),
  register: (body: RegisterRequest) => http.post<Session>('/users', body).then((res) => res.data),
  getSession: (options?: RequestOptions) => http.get<Session>('/session', options).then((res) => res.data),
  logout: () => http.delete('/session').then(() => undefined),

  // NFTs
  listNfts: (params: NftListParams, options?: RequestOptions) =>
    http.get<NftListResponse>('/nfts', { params: buildListQuery(params), signal: options?.signal }).then((res) => res.data),
  getNft: (id: string, options?: RequestOptions) => http.get<Nft>(`/nfts/${encodeURIComponent(id)}`, options).then((res) => res.data),

  // favoritos
  getFavorites: (options?: RequestOptions) => http.get<FavoritesResponse>('/favorites', options).then((res) => res.data),
  addFavorite: (nftId: string) => http.put<FavoritesResponse>(`/favorites/${encodeURIComponent(nftId)}`).then((res) => res.data),
  removeFavorite: (nftId: string) => http.delete<FavoritesResponse>(`/favorites/${encodeURIComponent(nftId)}`).then((res) => res.data),

  // carrinho
  getCart: (options?: RequestOptions) => http.get<CartResponse>('/cart', options).then((res) => res.data),
  addCartItem: (item: CartItemInput) => http.post<CartResponse>('/cart/items', item).then((res) => res.data),
  setCartItem: (nftId: string, editionId: string, quantity: number) =>
    http.patch<CartResponse>(`/cart/items/${nftId}/${editionId}`, { quantity }).then((res) => res.data),
  removeCartItem: (nftId: string, editionId: string) =>
    http.delete<CartResponse>(`/cart/items/${nftId}/${editionId}`).then((res) => res.data),
  acknowledgeCart: () => http.post<CartResponse>('/cart/acknowledge').then((res) => res.data),
  applyCoupon: (code: string) => http.put<CartResponse>('/cart/coupon', { code }).then((res) => res.data),
  removeCoupon: () => http.delete<CartResponse>('/cart/coupon').then((res) => res.data),

  // cotação
  quoteCart: (options?: RequestOptions) => http.post<Quote>('/quotes', { fromCart: true }, options).then((res) => res.data),

  // carteiras
  getWallets: (options?: RequestOptions) => http.get<Wallet[]>('/wallets', options).then((res) => res.data),
  createWallet: (slot: WalletSlot, body: WalletInput) => http.post<Wallet>('/wallets', { ...body, slot }).then((res) => res.data),
  updateWallet: (id: string, body: WalletInput) => http.put<Wallet>(`/wallets/${id}`, body).then((res) => res.data),
  connectWallet: (body: { walletId?: string; provider: WalletProvider; network: Network; address?: string }) =>
    http.post<WalletSession>('/wallet-sessions', body).then((res) => res.data),
  getWalletSession: (id: string) => http.get<WalletSession>(`/wallet-sessions/${id}`).then((res) => res.data),
  disconnectWallet: (id: string) => http.delete(`/wallet-sessions/${id}`).then(() => undefined),

  // pedidos
  createOrder: (body: CreateOrderRequest, idempotencyKey: string) =>
    http.post<Order>('/orders', body, { headers: { 'Idempotency-Key': idempotencyKey } }).then((res) => res.data),
  getOrder: (id: string, options?: RequestOptions) => http.get<Order>(`/orders/${encodeURIComponent(id)}`, options).then((res) => res.data),

  // perfil
  getProfile: (options?: RequestOptions) => http.get<Profile>('/profile', options).then((res) => res.data),
  updateProfile: (body: ProfileUpdate) => http.patch<Profile>('/profile', body).then((res) => res.data),
  uploadAvatar: (file: File) => {
    const formData = new FormData()
    formData.append('avatar', file)
    return http.put<Profile>('/profile/avatar', formData).then((res) => res.data)
  },
  removeAvatar: () => http.delete<Profile>('/profile/avatar').then((res) => res.data),
  changePassword: (body: PasswordChange) => http.post('/profile/password', body).then(() => undefined),
}
