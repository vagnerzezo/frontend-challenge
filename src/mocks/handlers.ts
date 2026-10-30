import { delay, http, HttpResponse } from 'msw'
import type {
  CartItemInput,
  CollectionSlug,
  CreateOrderRequest,
  LoginRequest,
  Network,
  NftListParams,
  PasswordChange,
  ProfileUpdate,
  QuoteRequest,
  RegisterRequest,
  Wallet,
  WalletInput,
  WalletSession,
  WalletSlot,
} from '@/api/contracts'
import {
  emailSchema,
  passwordSchema,
  profileSchema,
  registerSchema,
  walletSchema,
  zodFields,
} from '@/api/schemas'
import { createSession, bearerToken, cartOwnerKey, requireUser, toUser } from './auth'
import { getConfig, resetConfig, setConfig, type MockConfig } from './config'
import { db, hashPassword } from './db'
import {
  acknowledgeCart,
  addToCart,
  buildQuote,
  cartView,
  createOrderRecord,
  getCartRecord,
  getNft,
  listNfts,
  mergeGuestCart,
  publicOrder,
  removeFromCart,
  resetDomainTimers,
  resolveOrder,
  setCartCoupon,
  setCartQuantity,
  updateNft,
} from './domain'
import { fail, readJson, withNetwork } from './http'
import { connectionCount, dropConnections, realtimeHandler, replayEvent, resetRealtime } from './realtime'

const API = '/api'
const ADMIN = '/__mock'

// contadores usados pelos cenários (zerados no reset ou ao trocar de cenário)
const catalogFailures = new Map<string, number>()
let catalogRequestCount = 0
const timedOutKeys = new Set<string>()
const soldOutNfts = new Set<string>()

export function resetScenarioCounters() {
  catalogFailures.clear()
  catalogRequestCount = 0
  timedOutKeys.clear()
  soldOutNfts.clear()
}

function readListParams(url: URL): NftListParams {
  const query = url.searchParams
  const readList = (name: string) => query.get(name)?.split(',').filter(Boolean)
  return {
    q: query.get('q') ?? undefined,
    collections: readList('collections') as CollectionSlug[] | undefined,
    networks: readList('networks') as Network[] | undefined,
    minPrice: query.get('minPrice') ?? undefined,
    maxPrice: query.get('maxPrice') ?? undefined,
    tab: (query.get('tab') as NftListParams['tab']) ?? undefined,
    sort: (query.get('sort') as NftListParams['sort']) ?? undefined,
    page: query.get('page') ? Number(query.get('page')) : undefined,
    pageSize: query.get('pageSize') ? Number(query.get('pageSize')) : undefined,
  }
}

// transforma o valor em texto com as chaves sempre na mesma ordem,
// para o mesmo conteúdo gerar sempre o mesmo texto
function toSortedJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(toSortedJson).join(',')}]`

  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>
    const keys = Object.keys(object)
      .sort()
      .filter((key) => object[key] !== undefined)
    const parts = keys.map((key) => `${JSON.stringify(key)}:${toSortedJson(object[key])}`)
    return `{${parts.join(',')}}`
  }

  return JSON.stringify(value)
}

// usado para saber se duas requisições com a mesma chave de idempotência têm o mesmo corpo
function hashRequestBody(value: unknown): string {
  const text = toSortedJson(value)
  let hash = 5381
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i)
  }
  return (hash >>> 0).toString(36) + ':' + text.length
}

async function fileToDataUrl(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return `data:${file.type};base64,${btoa(binary)}`
}

// responde 409 se o usuário ou e-mail já estiver em uso por outra pessoa
function checkUsernameAndEmail(userId: string | null, username: string, email: string) {
  const fields: Record<string, string> = {}
  for (const user of Object.values(db.state.users)) {
    if (user.id === userId) continue
    if (user.username === username) fields.username = 'Este nome de usuário já está em uso.'
    if (user.email.toLowerCase() === email.toLowerCase()) fields.email = 'Este e-mail já está cadastrado.'
  }
  if (Object.keys(fields).length > 0) fail(409, 'CONFLICT', 'Dados já cadastrados.', fields)
}

function getUserWallets(userId: string) {
  return Object.values(db.state.wallets).filter((wallet) => wallet.userId === userId)
}

// remove o userId antes de responder
function withoutUserId<T extends { userId: string }>({ userId: _userId, ...rest }: T) {
  return rest
}

export const restHandlers = [
  // Sessão e conta
  http.post(
    `${API}/session`,
    withNetwork(async ({ request }) => {
      const body = await readJson<LoginRequest>(request)
      const fields: Record<string, string> = {}
      if (!emailSchema.safeParse(body.email).success) fields.email = 'Informe um e-mail válido.'
      if (!body.password) fields.password = 'Senha é obrigatória.'
      if (Object.keys(fields).length) fail(422, 'VALIDATION_ERROR', 'Verifique os campos.', fields)
      const email = body.email.trim().toLowerCase()
      const user = Object.values(db.state.users).find((item) => item.email.toLowerCase() === email)
      if (!user || (await hashPassword(body.password, user.salt)) !== user.passwordHash) {
        fail(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
      }
      mergeGuestCart(body.guestCartId, user!.id)
      return HttpResponse.json(createSession(user!.id), { status: 201 })
    }),
  ),
  http.get(
    `${API}/session`,
    withNetwork(({ request }) => {
      const user = requireUser(request)
      const token = bearerToken(request)!
      return HttpResponse.json({ token, user: toUser(user), expiresAt: new Date(db.state.sessions[token].expiresAt).toISOString() })
    }),
  ),
  http.delete(
    `${API}/session`,
    withNetwork(({ request }) => {
      const token = bearerToken(request)
      if (token) delete db.state.sessions[token]
      db.save()
      return new HttpResponse(null, { status: 204 })
    }),
  ),
  http.post(
    `${API}/users`,
    withNetwork(async ({ request }) => {
      const body = await readJson<RegisterRequest>(request)
      const parsed = registerSchema.safeParse({ ...body, confirmPassword: body.password })
      if (!parsed.success) fail(422, 'VALIDATION_ERROR', 'Verifique os campos.', zodFields(parsed.error))
      checkUsernameAndEmail(null, body.username.trim(), body.email.trim())
      const id = db.nextId('usr')
      const salt = crypto.randomUUID()
      db.state.users[id] = {
        id,
        username: body.username.trim(),
        email: body.email.trim(),
        displayName: body.username.trim(),
        avatarUrl: null,
        walletNickname: 'Principal',
        ensName: body.username.trim().replace(/[^a-z0-9-]/g, '-'),
        salt,
        passwordHash: await hashPassword(body.password, salt),
      }
      db.state.favorites[id] = []
      db.save()
      mergeGuestCart(body.guestCartId, id)
      return HttpResponse.json(createSession(id), { status: 201 })
    }),
  ),

  // NFTs
  http.get(
    `${API}/nfts`,
    withNetwork(async ({ request }) => {
      const config = getConfig()
      // cada busca falha 3 vezes (mais que os retries do cliente) e depois volta a funcionar
      const failures = catalogFailures.get(request.url) ?? 0
      if (config.scenario === 'catalog-error' && failures < 3) {
        catalogFailures.set(request.url, failures + 1)
        fail(503, 'TRANSIENT', 'Catálogo temporariamente indisponível.')
      }
      if (config.scenario === 'out-of-order') {
        // as requisições mais antigas respondem por último (1.8s, 0.6s, 0.2s, ...)
        const delays = [1800, 600, 200]
        const requestNumber = catalogRequestCount
        catalogRequestCount++
        await delay(delays[requestNumber % 3])
      }
      return HttpResponse.json(listNfts(readListParams(new URL(request.url))))
    }),
  ),
  http.get(
    `${API}/nfts/:id`,
    withNetwork(({ params }) => HttpResponse.json(getNft(String(params.id)))),
  ),

  // Favoritos
  http.get(
    `${API}/favorites`,
    withNetwork(({ request }) => {
      const user = requireUser(request)
      return HttpResponse.json({ nftIds: db.state.favorites[user.id] ?? [] })
    }),
  ),
  http.put(
    `${API}/favorites/:nftId`,
    withNetwork(({ request, params }) => {
      const user = requireUser(request)
      const nft = getNft(String(params.nftId))
      if (getConfig().scenario === 'favorites-error') fail(500, 'INTERNAL', 'Não foi possível salvar o favorito.')
      const list = (db.state.favorites[user.id] ??= [])
      if (!list.includes(nft.id)) list.push(nft.id)
      db.save()
      return HttpResponse.json({ nftIds: list })
    }),
  ),
  http.delete(
    `${API}/favorites/:nftId`,
    withNetwork(({ request, params }) => {
      const user = requireUser(request)
      if (getConfig().scenario === 'favorites-error') fail(500, 'INTERNAL', 'Não foi possível remover o favorito.')
      db.state.favorites[user.id] = (db.state.favorites[user.id] ?? []).filter((id) => id !== params.nftId)
      db.save()
      return HttpResponse.json({ nftIds: db.state.favorites[user.id] })
    }),
  ),

  // Carrinho
  http.get(
    `${API}/cart`,
    withNetwork(({ request }) => HttpResponse.json(cartView(cartOwnerKey(request)))),
  ),
  http.post(
    `${API}/cart/items`,
    withNetwork(async ({ request }) => {
      const owner = cartOwnerKey(request)
      addToCart(owner, await readJson<CartItemInput>(request))
      return HttpResponse.json(cartView(owner), { status: 201 })
    }),
  ),
  http.patch(
    `${API}/cart/items/:nftId/:editionId`,
    withNetwork(async ({ request, params }) => {
      const owner = cartOwnerKey(request)
      const { quantity } = await readJson<{ quantity: number }>(request)
      setCartQuantity(owner, String(params.nftId), String(params.editionId), quantity)
      return HttpResponse.json(cartView(owner))
    }),
  ),
  http.delete(
    `${API}/cart/items/:nftId/:editionId`,
    withNetwork(({ request, params }) => {
      const owner = cartOwnerKey(request)
      removeFromCart(owner, String(params.nftId), String(params.editionId))
      return HttpResponse.json(cartView(owner))
    }),
  ),
  http.post(
    `${API}/cart/acknowledge`,
    withNetwork(({ request }) => {
      const owner = cartOwnerKey(request)
      acknowledgeCart(owner)
      return HttpResponse.json(cartView(owner))
    }),
  ),
  http.put(
    `${API}/cart/coupon`,
    withNetwork(async ({ request }) => {
      const owner = cartOwnerKey(request)
      const { code } = await readJson<{ code: string }>(request)
      if (!code?.trim()) fail(422, 'VALIDATION_ERROR', 'Informe um código.', { couponCode: 'Informe um código promocional.' })
      setCartCoupon(owner, code)
      return HttpResponse.json(cartView(owner))
    }),
  ),
  http.delete(
    `${API}/cart/coupon`,
    withNetwork(({ request }) => {
      const owner = cartOwnerKey(request)
      setCartCoupon(owner, null)
      return HttpResponse.json(cartView(owner))
    }),
  ),

  // Cotação
  http.post(
    `${API}/quotes`,
    withNetwork(async ({ request }) => {
      const owner = cartOwnerKey(request)
      const body = await readJson<Partial<QuoteRequest> & { fromCart?: boolean }>(request)
      const cart = getCartRecord(owner)
      const items = body.fromCart || !body.items ? cart.items.map(({ nftId, editionId, quantity }) => ({ nftId, editionId, quantity })) : body.items
      const coupon = body.fromCart || body.couponCode === undefined ? cart.couponCode : body.couponCode
      return HttpResponse.json(buildQuote(owner, items, coupon), { status: 201 })
    }),
  ),

  // Carteiras
  http.get(
    `${API}/wallets`,
    withNetwork(({ request }) => {
      const user = requireUser(request)
      return HttpResponse.json(getUserWallets(user.id).map(withoutUserId))
    }),
  ),
  http.post(
    `${API}/wallets`,
    withNetwork(async ({ request }) => {
      const user = requireUser(request)
      const body = await readJson<WalletInput & { slot: WalletSlot }>(request)
      if (body.slot !== 'primary' && body.slot !== 'secondary') fail(422, 'VALIDATION_ERROR', 'Slot inválido.', { slot: 'Slot inválido.' })
      const parsed = walletSchema.safeParse(body)
      if (!parsed.success) fail(422, 'VALIDATION_ERROR', 'Verifique os campos da carteira.', zodFields(parsed.error))
      const userWallets = getUserWallets(user.id)
      if (userWallets.some((wallet) => wallet.slot === body.slot)) fail(409, 'CONFLICT', 'Esta carteira já está cadastrada.')
      if (body.slot === 'secondary' && !userWallets.some((wallet) => wallet.slot === 'primary')) {
        fail(422, 'VALIDATION_ERROR', 'Cadastre a carteira principal primeiro.')
      }
      const wallet: Wallet & { userId: string } = {
        ...parsed.data!,
        secondaryAddress: parsed.data!.secondaryAddress ?? '',
        id: db.nextId('wal'),
        slot: body.slot,
        userId: user.id,
        updatedAt: new Date().toISOString(),
      }
      db.state.wallets[wallet.id] = wallet
      db.save()
      return HttpResponse.json(withoutUserId(wallet), { status: 201 })
    }),
  ),
  http.put(
    `${API}/wallets/:id`,
    withNetwork(async ({ request, params }) => {
      const user = requireUser(request)
      const wallet = db.state.wallets[String(params.id)] ?? fail(404, 'NOT_FOUND', 'Carteira não encontrada.')
      if (wallet.userId !== user.id) fail(403, 'FORBIDDEN', 'Sem permissão para esta carteira.')
      const parsed = walletSchema.safeParse(await readJson<WalletInput>(request))
      if (!parsed.success) fail(422, 'VALIDATION_ERROR', 'Verifique os campos da carteira.', zodFields(parsed.error))
      Object.assign(wallet, parsed.data, { secondaryAddress: parsed.data!.secondaryAddress ?? '', updatedAt: new Date().toISOString() })
      db.save()
      return HttpResponse.json(withoutUserId(wallet))
    }),
  ),

  // Sessões de carteira (simulação de conexão / recusa / desconexão)
  http.post(
    `${API}/wallet-sessions`,
    withNetwork(async ({ request }) => {
      const user = requireUser(request)
      const body = await readJson<{ walletId?: string; provider: WalletSession['provider']; network: Network; address?: string }>(request)
      if (getConfig().scenario === 'wallet-reject') fail(403, 'WALLET_REJECTED', 'A conexão foi recusada na carteira.')
      let address = body.address ?? ''
      if (body.walletId) {
        const wallet = db.state.wallets[body.walletId] ?? fail(404, 'NOT_FOUND', 'Carteira não encontrada.')
        if (wallet.userId !== user.id) fail(403, 'FORBIDDEN', 'Sem permissão para esta carteira.')
        address = wallet.address
      }
      if (!address) fail(422, 'VALIDATION_ERROR', 'Endereço da carteira é obrigatório.', { address: 'Informe o endereço.' })
      const session = {
        id: db.nextId('ws'),
        walletId: body.walletId ?? 'external',
        network: body.network,
        provider: body.provider,
        status: 'connected' as const,
        userId: user.id,
        address,
      }
      db.state.walletSessions[session.id] = session
      db.save()
      return HttpResponse.json(withoutUserId(session), { status: 201 })
    }),
  ),
  http.get(
    `${API}/wallet-sessions/:id`,
    withNetwork(({ request, params }) => {
      const user = requireUser(request)
      const walletSession = db.state.walletSessions[String(params.id)]
      if (!walletSession || walletSession.userId !== user.id) fail(404, 'NOT_FOUND', 'Sessão de carteira não encontrada.')
      return HttpResponse.json(withoutUserId(walletSession!))
    }),
  ),
  http.delete(
    `${API}/wallet-sessions/:id`,
    withNetwork(({ request, params }) => {
      const user = requireUser(request)
      const walletSession = db.state.walletSessions[String(params.id)]
      if (walletSession && walletSession.userId === user.id) walletSession.status = 'disconnected'
      db.save()
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  // Pedidos
  http.post(
    `${API}/orders`,
    withNetwork(async ({ request }) => {
      const user = requireUser(request)
      const key = request.headers.get('idempotency-key')
      if (!key || !/^[a-zA-Z0-9-]{8,80}$/.test(key)) fail(422, 'VALIDATION_ERROR', 'Cabeçalho Idempotency-Key ausente ou inválido.')
      const body = await readJson<CreateOrderRequest>(request)
      const requestHash = hashRequestBody(body)

      // mesma chave e mesmo corpo: devolve o pedido que já existe; corpo diferente: conflito
      const existingId = db.state.idempotency[`${user.id}:${key}`]
      if (existingId) {
        const existing = db.state.orders[existingId]
        if (existing.requestHash !== requestHash) {
          fail(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
        }
        if (existing.status === 'pending' && existing.resolveAt <= Date.now()) resolveOrder(existing.id)
        return HttpResponse.json(publicOrder(existing), { status: 200 })
      }

      const quote = db.state.quotes[body.quoteId] ?? fail(409, 'QUOTE_STALE', 'Cotação não encontrada. Revise o pedido.')
      if (quote.ownerKey !== `user:${user.id}`) fail(403, 'FORBIDDEN', 'Cotação pertence a outro usuário.')

      const firstItem = quote.items[0]
      if (getConfig().scenario === 'sold-out-on-checkout' && !soldOutNfts.has(firstItem.nftId)) {
        soldOutNfts.add(firstItem.nftId)
        updateNft(firstItem.nftId, { editions: { [firstItem.editionId]: 0 } })
      }

      // confere de novo preço, estoque, cupom e taxa
      const fresh = buildQuote(
        quote.ownerKey,
        quote.items.map(({ nftId, editionId, quantity }) => ({ nftId, editionId, quantity })),
        quote.coupon?.code ?? null,
      )
      const expired = Date.parse(quote.expiresAt) < Date.now()
      if (expired || fresh.fingerprint !== quote.fingerprint || body.quoteFingerprint !== quote.fingerprint) {
        fail(409, 'QUOTE_STALE', 'Os valores do pedido mudaram. Revise e confirme novamente.', undefined, { quote: fresh })
      }

      const walletSession = db.state.walletSessions[body.walletSessionId]
      if (!walletSession || walletSession.userId !== user.id) {
        fail(422, 'VALIDATION_ERROR', 'Conecte uma carteira.', { wallet: 'Conecte uma carteira.' })
      }
      if (walletSession.status !== 'connected') fail(409, 'WALLET_DISCONNECTED', 'A carteira foi desconectada. Conecte novamente.')

      const wallet = Object.values(db.state.wallets).find((item) => item.id === walletSession.walletId)
      const order = createOrderRecord({
        userId: user.id,
        key: key!,
        requestHash,
        quote: fresh,
        wallet: {
          provider: walletSession.provider,
          network: walletSession.network,
          address: walletSession.address,
          label: wallet?.nickname ?? 'Carteira externa',
        },
      })

      if (getConfig().scenario === 'order-timeout' && !timedOutKeys.has(key!)) {
        // o pedido é criado, mas a resposta só chega depois do timeout do cliente
        timedOutKeys.add(key!)
        await delay(15_000)
      }
      return HttpResponse.json(publicOrder(order), { status: 201 })
    }),
  ),
  http.get(
    `${API}/orders/:id`,
    withNetwork(({ request, params }) => {
      const user = requireUser(request)
      const order = db.state.orders[String(params.id)] ?? fail(404, 'NOT_FOUND', 'Pedido não encontrado.')
      if (order.userId !== user.id) fail(403, 'FORBIDDEN', 'Este pedido pertence a outro colecionador.')
      if (order.status === 'pending' && order.resolveAt <= Date.now()) resolveOrder(order.id)
      return HttpResponse.json(publicOrder(order))
    }),
  ),

  // Perfil
  http.get(
    `${API}/profile`,
    withNetwork(({ request }) => {
      const user = requireUser(request)
      return HttpResponse.json({ ...toUser(user), walletNickname: user.walletNickname, ensName: user.ensName })
    }),
  ),
  http.patch(
    `${API}/profile`,
    withNetwork(async ({ request }) => {
      const user = requireUser(request)
      const body = await readJson<ProfileUpdate>(request)
      const parsed = profileSchema.safeParse(body)
      if (!parsed.success) fail(422, 'VALIDATION_ERROR', 'Verifique os campos.', zodFields(parsed.error))
      checkUsernameAndEmail(user.id, parsed.data!.username, parsed.data!.email)
      Object.assign(user, parsed.data)
      db.save()
      return HttpResponse.json({ ...toUser(user), walletNickname: user.walletNickname, ensName: user.ensName })
    }),
  ),
  http.put(
    `${API}/profile/avatar`,
    withNetwork(async ({ request }) => {
      const user = requireUser(request)
      const form = await request.formData()
      const file = form.get('avatar')
      if (!(file instanceof File)) return fail(422, 'VALIDATION_ERROR', 'Envie uma imagem.', { avatar: 'Envie uma imagem.' })
      if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) fail(422, 'VALIDATION_ERROR', 'Formato inválido.', { avatar: 'Use PNG, JPG, WebP ou GIF.' })
      if (file.size > 2 * 1024 * 1024) fail(422, 'VALIDATION_ERROR', 'Imagem muito grande.', { avatar: 'A imagem deve ter até 2 MB.' })
      user.avatarUrl = await fileToDataUrl(file)
      db.save()
      return HttpResponse.json({ ...toUser(user), walletNickname: user.walletNickname, ensName: user.ensName })
    }),
  ),
  http.delete(
    `${API}/profile/avatar`,
    withNetwork(({ request }) => {
      const user = requireUser(request)
      user.avatarUrl = null
      db.save()
      return HttpResponse.json({ ...toUser(user), walletNickname: user.walletNickname, ensName: user.ensName })
    }),
  ),
  http.post(
    `${API}/profile/password`,
    withNetwork(async ({ request }) => {
      const user = requireUser(request)
      const body = await readJson<PasswordChange>(request)
      if ((await hashPassword(body.currentPassword ?? '', user.salt)) !== user.passwordHash) {
        fail(422, 'VALIDATION_ERROR', 'Senha atual incorreta.', { currentPassword: 'Senha atual incorreta.' })
      }
      const parsed = passwordSchema.safeParse(body.newPassword)
      if (!parsed.success) fail(422, 'VALIDATION_ERROR', 'Senha inválida.', { newPassword: parsed.error!.issues[0].message })
      user.salt = crypto.randomUUID()
      user.passwordHash = await hashPassword(body.newPassword, user.salt)
      db.save()
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  // fallback: rota de API inexistente
  http.all(`${API}/*`, withNetwork(() => fail(404, 'NOT_FOUND', 'Recurso inexistente.'))),
]

// Rotas de controle da simulação, usadas pelo painel e pelos testes (sem latência nem falhas)
export const adminHandlers = [
  http.get(`${ADMIN}/state`, () =>
    HttpResponse.json({ config: getConfig(), sockets: connectionCount(), users: Object.keys(db.state.users).length }),
  ),
  http.put(`${ADMIN}/config`, async ({ request }) => {
    const changes = (await request.json()) as Partial<MockConfig>
    if (changes.scenario) resetScenarioCounters()
    return HttpResponse.json(setConfig(changes))
  }),
  http.post(`${ADMIN}/reset`, async () => {
    resetDomainTimers()
    resetScenarioCounters()
    resetRealtime()
    await db.reset()
    return HttpResponse.json({ config: resetConfig() })
  }),
  http.patch(`${ADMIN}/nfts/:id`, async ({ params, request }) => {
    const body = (await request.json()) as { price?: string; editions?: Record<string, number> }
    const nft = updateNft(String(params.id), body)
    return HttpResponse.json(nft)
  }),
  http.post(`${ADMIN}/events/replay`, async ({ request }) => {
    const { mode, resourceId } = (await request.json()) as { mode: 'duplicate' | 'stale'; resourceId?: string }
    return HttpResponse.json({ sent: replayEvent(mode, resourceId) })
  }),
  http.post(`${ADMIN}/socket/drop`, async ({ request }) => {
    const { holdMs = 0 } = ((await request.json().catch(() => ({}))) ?? {}) as { holdMs?: number }
    dropConnections(holdMs)
    return HttpResponse.json({ ok: true })
  }),
  http.post(`${ADMIN}/sessions/expire`, () => {
    for (const session of Object.values(db.state.sessions)) session.expiresAt = Date.now() - 1
    db.save()
    return HttpResponse.json({ ok: true })
  }),
  http.post(`${ADMIN}/wallet-sessions/disconnect`, () => {
    for (const walletSession of Object.values(db.state.walletSessions)) walletSession.status = 'disconnected'
    db.save()
    return HttpResponse.json({ ok: true })
  }),
  http.post(`${ADMIN}/orders/:id/resolve`, ({ params }) => {
    resolveOrder(String(params.id))
    return HttpResponse.json({ ok: true })
  }),
]

export const handlers = [...adminHandlers, ...restHandlers, realtimeHandler]
