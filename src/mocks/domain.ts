import Big from 'big.js'
import type {
  Cart,
  CartItemInput,
  CatalogSort,
  CollectionSlug,
  Network,
  Nft,
  NftListParams,
  NftListResponse,
  NftSummary,
  Order,
  Quote,
  QuoteLine,
} from '@/api/contracts'
import { COLLECTION_LABELS, COUPONS, NETWORK_FEE, NETWORK_LABELS } from './fixtures'
import { db, type CartRecord, type OrderRecord } from './db'
import { fail } from './http'
import { broadcastNftUpdated, sendOrderUpdated } from './realtime'
import { getConfig } from './config'

Big.DP = 18

// Catálogo

export function toSummary(nft: Nft): NftSummary {
  return {
    id: nft.id,
    name: nft.name,
    tokenId: nft.tokenId,
    image: nft.image,
    price: nft.price,
    previousPrice: nft.previousPrice,
    rare: nft.rare,
    network: nft.network,
    collection: nft.collection,
    available: nft.available,
    version: nft.version,
  }
}

// o id desempata para a ordem ser sempre a mesma
const SORTERS: Record<CatalogSort, (a: Nft, b: Nft) => number> = {
  recentes: (a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
  'preco-asc': (a, b) => new Big(a.price).cmp(b.price) || a.id.localeCompare(b.id),
  'preco-desc': (a, b) => new Big(b.price).cmp(a.price) || a.id.localeCompare(b.id),
  nome: (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
}

export function listNfts(params: NftListParams): NftListResponse {
  const all = db.state.nftOrder.map((id) => db.state.nfts[id])
  const search = params.q?.trim().toLowerCase()

  // filtros que não são coleção nem rede
  const matchesBaseFilters = (nft: Nft) => {
    if (search && !`${nft.name} ${nft.collectionName} ${nft.tokenId}`.toLowerCase().includes(search)) return false
    if (params.tab === 'novos' && Date.parse(nft.createdAt) < Date.UTC(2026, 8, 1)) return false
    if (params.tab === 'em-alta' && !(nft.rare || nft.reviewsCount >= 19)) return false
    if (params.minPrice && new Big(nft.price).lt(params.minPrice)) return false
    if (params.maxPrice && new Big(nft.price).gt(params.maxPrice)) return false
    return true
  }
  const inCollections = (nft: Nft) => !params.collections?.length || params.collections.includes(nft.collection)
  const inNetworks = (nft: Nft) => !params.networks?.length || params.networks.includes(nft.network)

  const filtered = all.filter((nft) => matchesBaseFilters(nft) && inCollections(nft) && inNetworks(nft))
  filtered.sort(SORTERS[params.sort ?? 'recentes'])

  // quantidade de NFTs em cada opção de filtro, levando em conta os outros filtros
  const collections = (Object.keys(COLLECTION_LABELS) as CollectionSlug[]).map((value) => ({
    value,
    label: COLLECTION_LABELS[value],
    count: all.filter((nft) => matchesBaseFilters(nft) && inNetworks(nft) && nft.collection === value).length,
  }))
  const networks = (Object.keys(NETWORK_LABELS) as Network[]).map((value) => ({
    value,
    label: NETWORK_LABELS[value],
    count: all.filter((nft) => matchesBaseFilters(nft) && inCollections(nft) && nft.network === value).length,
  }))

  let min = new Big(all[0]?.price ?? 0)
  let max = new Big(all[0]?.price ?? 0)
  for (const nft of all) {
    if (new Big(nft.price).lt(min)) min = new Big(nft.price)
    if (new Big(nft.price).gt(max)) max = new Big(nft.price)
  }

  const pageSize = Math.min(Math.max(params.pageSize ?? 9, 1), 48)
  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(params.page ?? 1, 1), totalPages)
  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize).map(toSummary),
    page,
    pageSize,
    total,
    totalPages,
    facets: { collections, networks, priceRange: { min: min.toFixed(2), max: max.toFixed(2) } },
    applied: { ...params, page, pageSize },
  }
}

export function getNft(id: string): Nft {
  return db.state.nfts[id] ?? fail(404, 'NOT_FOUND', 'NFT não encontrado.')
}

function updateTotalAvailable(nft: Nft) {
  let total = 0
  for (const edition of nft.editions) total += edition.available
  nft.available = total
}

// muda preço/estoque, aumenta a versão e avisa os clientes pelo socket
export function updateNft(id: string, changes: { price?: string; editions?: Record<string, number> }) {
  const nft = getNft(id)

  if (changes.price && changes.price !== nft.price) {
    nft.previousPrice = nft.price
    nft.price = new Big(changes.price).toFixed(2)
    nft.editions = nft.editions.map((edition) => ({ ...edition, price: nft.price }))
  }

  const editionChanges = changes.editions
  if (editionChanges) {
    nft.editions = nft.editions.map((edition) => {
      if (!(edition.id in editionChanges)) return edition
      return { ...edition, available: Math.max(0, editionChanges[edition.id]) }
    })
  }

  updateTotalAvailable(nft)
  nft.version += 1
  db.save()
  broadcastNftUpdated(nft.id)
  return nft
}

// Carrinho

function findEdition(nftId: string, editionId: string) {
  const nft = db.state.nfts[nftId] ?? fail(404, 'NOT_FOUND', 'NFT não encontrado.')
  const edition = nft.editions.find((item) => item.id === editionId) ?? fail(404, 'NOT_FOUND', 'Edição não encontrada.')
  return { nft, edition }
}

export function getCartRecord(ownerKey: string): CartRecord {
  let cart = db.state.carts[ownerKey]
  if (!cart) {
    cart = { id: db.nextId('cart'), items: [], couponCode: null, updatedAt: new Date().toISOString() }
    db.state.carts[ownerKey] = cart
  }
  return cart
}

export function cartView(ownerKey: string): Cart & { couponCode: string | null } {
  const cart = getCartRecord(ownerKey)
  const items = cart.items
    .filter((item) => db.state.nfts[item.nftId])
    .map((item) => {
      const { nft, edition } = findEdition(item.nftId, item.editionId)
      return {
        nftId: nft.id,
        editionId: edition.id,
        editionLabel: edition.label,
        name: nft.name,
        tokenId: nft.tokenId,
        image: nft.image,
        quantity: item.quantity,
        unitPrice: edition.price,
        lineTotal: new Big(edition.price).times(item.quantity).toString(),
        available: edition.available,
        nftVersion: nft.version,
        priceWhenAdded: item.priceWhenAdded,
      }
    })

  return {
    id: cart.id,
    owner: ownerKey.startsWith('user:') ? 'user' : 'guest',
    couponCode: cart.couponCode,
    updatedAt: cart.updatedAt,
    items,
  }
}

function assertQuantity(quantity: unknown): number {
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
    return fail(422, 'VALIDATION_ERROR', 'Quantidade deve ser um inteiro maior que zero.', { quantity: 'Quantidade inválida.' })
  }
  return quantity
}

function assertAvailable(nftId: string, editionId: string, quantity: number) {
  const { nft, edition } = findEdition(nftId, editionId)
  if (edition.available === 0) {
    fail(409, 'AVAILABILITY_CONFLICT', `A edição ${edition.label} de ${nft.name} está esgotada.`, undefined, { nftId, editionId, available: 0 })
  }
  if (quantity > edition.available) {
    fail(409, 'AVAILABILITY_CONFLICT', `Apenas ${edition.available} unidade(s) disponível(is) da edição ${edition.label}.`, undefined, {
      nftId,
      editionId,
      available: edition.available,
    })
  }
  return edition
}

export function addToCart(ownerKey: string, input: CartItemInput) {
  const quantity = assertQuantity(input.quantity)
  const cart = getCartRecord(ownerKey)
  const existing = cart.items.find((item) => item.nftId === input.nftId && item.editionId === input.editionId)
  const edition = assertAvailable(input.nftId, input.editionId, (existing?.quantity ?? 0) + quantity)

  if (existing) {
    existing.quantity += quantity
  } else {
    cart.items.push({ nftId: input.nftId, editionId: input.editionId, quantity, priceWhenAdded: edition.price })
  }
  cart.updatedAt = new Date().toISOString()
  db.save()
}

export function setCartQuantity(ownerKey: string, nftId: string, editionId: string, newQuantity: number) {
  const quantity = assertQuantity(newQuantity)
  const cart = getCartRecord(ownerKey)
  const item = cart.items.find((cartItem) => cartItem.nftId === nftId && cartItem.editionId === editionId)
  if (!item) return fail(404, 'NOT_FOUND', 'Item não está no carrinho.')

  const edition = assertAvailable(nftId, editionId, quantity)
  item.quantity = quantity
  item.priceWhenAdded = edition.price
  cart.updatedAt = new Date().toISOString()
  db.save()
}

export function removeFromCart(ownerKey: string, nftId: string, editionId: string) {
  const cart = getCartRecord(ownerKey)
  cart.items = cart.items.filter((item) => !(item.nftId === nftId && item.editionId === editionId))
  cart.updatedAt = new Date().toISOString()
  db.save()
}

// o usuário viu os preços novos, então some o aviso de "preço alterado"
export function acknowledgeCart(ownerKey: string) {
  const cart = getCartRecord(ownerKey)
  for (const item of cart.items) {
    const edition = db.state.nfts[item.nftId]?.editions.find((ed) => ed.id === item.editionId)
    if (edition) item.priceWhenAdded = edition.price
  }
  db.save()
}

// junta o carrinho do visitante com o do usuário, respeitando o estoque
export function mergeGuestCart(guestId: string | undefined, userId: string) {
  if (!guestId) return
  const guestCart = db.state.carts[`guest:${guestId}`]
  if (!guestCart?.items.length) return

  const userCart = getCartRecord(`user:${userId}`)
  for (const guestItem of guestCart.items) {
    const edition = db.state.nfts[guestItem.nftId]?.editions.find((ed) => ed.id === guestItem.editionId)
    if (!edition || edition.available === 0) continue

    const existing = userCart.items.find((item) => item.nftId === guestItem.nftId && item.editionId === guestItem.editionId)
    if (existing) {
      existing.quantity = Math.min(edition.available, existing.quantity + guestItem.quantity)
    } else {
      userCart.items.push({ ...guestItem, quantity: Math.min(edition.available, guestItem.quantity) })
    }
  }
  if (!userCart.couponCode && guestCart.couponCode) userCart.couponCode = guestCart.couponCode
  userCart.updatedAt = new Date().toISOString()
  delete db.state.carts[`guest:${guestId}`]
  db.save()
}

// Cupom / Cotação

export function validateCoupon(code: string) {
  const normalized = code.trim().toUpperCase()
  const coupon = COUPONS[normalized]
  if (!coupon) return fail(422, 'COUPON_INVALID', 'Cupom inválido.', { couponCode: 'Código promocional inválido.' })
  if (Date.parse(coupon.expiresAt) < Date.now()) {
    return fail(422, 'COUPON_EXPIRED', 'Cupom expirado.', { couponCode: 'Este código promocional expirou.' })
  }
  return { code: normalized, percentOff: coupon.percentOff }
}

export function setCartCoupon(ownerKey: string, code: string | null) {
  const cart = getCartRecord(ownerKey)
  cart.couponCode = code ? validateCoupon(code).code : null
  db.save()
}

// texto que representa os valores da cotação; se algo mudar, o texto muda também
function buildFingerprint(lines: QuoteLine[], coupon: Quote['coupon'], fee: string) {
  const parts = lines.map((line) => `${line.nftId}/${line.editionId}x${line.quantity}@${line.unitPrice}`)
  parts.push(`coupon=${coupon?.code ?? ''}`)
  parts.push(`fee=${fee}`)
  return parts.join('|')
}

export function buildQuote(ownerKey: string, items: CartItemInput[], couponCode: string | null | undefined): Quote {
  if (!items.length) fail(422, 'VALIDATION_ERROR', 'Carrinho vazio.', { items: 'Adicione ao menos um NFT.' })
  const lines: QuoteLine[] = items.map((item) => {
    const quantity = assertQuantity(item.quantity)
    const { nft, edition } = findEdition(item.nftId, item.editionId)
    if (quantity > edition.available) {
      fail(409, 'AVAILABILITY_CONFLICT', `${nft.name} (${edition.label}) tem apenas ${edition.available} disponível(is).`, undefined, {
        nftId: nft.id,
        editionId: edition.id,
        available: edition.available,
      })
    }
    return {
      nftId: nft.id,
      editionId: edition.id,
      quantity,
      name: nft.name,
      tokenId: nft.tokenId,
      image: nft.image,
      editionLabel: edition.label,
      unitPrice: edition.price,
      lineTotal: new Big(edition.price).times(quantity).toString(),
      available: edition.available,
    }
  })

  const coupon = couponCode ? validateCoupon(couponCode) : null
  let subtotal = new Big(0)
  for (const line of lines) subtotal = subtotal.plus(line.lineTotal)
  const discount = coupon ? subtotal.times(coupon.percentOff).div(100).round(6, Big.roundDown) : new Big(0)
  const total = subtotal.minus(discount).plus(NETWORK_FEE)
  const now = Date.now()
  const quote: Quote = {
    id: db.nextId('qt'),
    items: lines,
    coupon,
    subtotal: subtotal.toString(),
    discount: discount.toString(),
    networkFee: NETWORK_FEE,
    total: total.toString(),
    fingerprint: buildFingerprint(lines, coupon, NETWORK_FEE),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 5 * 60_000).toISOString(),
  }
  db.state.quotes[quote.id] = { ...quote, ownerKey }
  db.save()
  return quote
}

// Pedidos

// tira os campos internos do pedido antes de mandar para o cliente
export function publicOrder(order: OrderRecord): Order {
  const { userId: _userId, requestHash: _requestHash, quoteId: _quoteId, resolveAt: _resolveAt, ...rest } = order
  return rest
}

// gera um hash de transação falso, mas sempre igual para o mesmo pedido
function fakeTransactionHash(seed: string) {
  let hash = ''
  let value = 0
  for (let i = 0; i < 64; i++) {
    value = (value * 31 + seed.charCodeAt(i % seed.length) + i) % 16
    hash += value.toString(16)
  }
  return `0x${hash}`
}

const orderTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function scheduleResolution(order: OrderRecord) {
  if (order.status !== 'pending' || orderTimers.has(order.id)) return

  const delayMs = Math.max(0, order.resolveAt - Date.now())
  const timer = setTimeout(() => {
    orderTimers.delete(order.id)
    resolveOrder(order.id)
  }, delayMs)
  orderTimers.set(order.id, timer)
}

// finaliza um pedido pendente (confirmado ou recusado) e avisa o cliente
export function resolveOrder(orderId: string) {
  const order = db.state.orders[orderId]
  if (!order || order.status !== 'pending') return

  // se algum item esgotou enquanto o pagamento estava pendente, o pedido é recusado
  const soldOutItem = order.items.find((item) => {
    const edition = db.state.nfts[item.nftId]?.editions.find((ed) => ed.id === item.editionId)
    return !edition || edition.available < item.quantity
  })

  order.status = soldOutItem ? 'rejected' : 'confirmed'
  order.version += 1
  order.updatedAt = new Date().toISOString()
  order.failureReason = soldOutItem ? `${soldOutItem.name} (${soldOutItem.editionLabel}) esgotou antes da confirmação.` : null

  if (order.status === 'confirmed') {
    order.transactionHash = fakeTransactionHash(order.id + order.idempotencyKey)
    order.explorerUrl = `https://etherscan.io/tx/${order.transactionHash}`

    // baixa o estoque e tira do carrinho só as quantidades que foram compradas
    const cart = getCartRecord(`user:${order.userId}`)
    const changedNftIds = new Set<string>()
    for (const item of order.items) {
      const nft = db.state.nfts[item.nftId]
      const edition = nft.editions.find((ed) => ed.id === item.editionId)!
      edition.available -= item.quantity
      changedNftIds.add(nft.id)

      const cartItem = cart.items.find((ci) => ci.nftId === item.nftId && ci.editionId === item.editionId)
      if (cartItem) cartItem.quantity -= item.quantity
    }
    cart.items = cart.items.filter((item) => item.quantity > 0)
    if (order.coupon && cart.couponCode === order.coupon.code) cart.couponCode = null

    for (const id of changedNftIds) {
      const nft = db.state.nfts[id]
      updateTotalAvailable(nft)
      nft.version += 1
    }
    db.save()
    for (const id of changedNftIds) broadcastNftUpdated(id)
  }

  db.save()
  sendOrderUpdated(order.id)
}

// depois de um refresh, volta a agendar os pedidos que ainda estão pendentes
export function resumePendingOrders() {
  for (const order of Object.values(db.state.orders)) scheduleResolution(order)
}

export function createOrderRecord(input: {
  userId: string
  key: string
  requestHash: string
  quote: Quote
  wallet: Order['wallet']
}): OrderRecord {
  const now = Date.now()
  const order: OrderRecord = {
    id: db.nextId('ord'),
    status: 'pending',
    version: 1,
    idempotencyKey: input.key,
    items: input.quote.items,
    subtotal: input.quote.subtotal,
    discount: input.quote.discount,
    networkFee: input.quote.networkFee,
    total: input.quote.total,
    coupon: input.quote.coupon,
    wallet: input.wallet,
    transactionHash: null,
    explorerUrl: null,
    failureReason: null,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    userId: input.userId,
    requestHash: input.requestHash,
    quoteId: input.quote.id,
    resolveAt: now + getConfig().orderResolutionMs,
  }
  db.state.orders[order.id] = order
  db.state.idempotency[`${input.userId}:${input.key}`] = order.id
  db.save()
  scheduleResolution(order)
  return order
}

export function resetDomainTimers() {
  for (const timer of orderTimers.values()) clearTimeout(timer)
  orderTimers.clear()
}
