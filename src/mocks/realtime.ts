import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/api/contracts'
import { db } from './db'
import { sessionUser } from './auth'

// Servidor Socket.IO simulado usando o WebSocket do MSW.
//
// Limitações do @mswjs/socket.io-binding (mais detalhes no ARCHITECTURE.md):
//  - o `auth` da conexão não é lido, então o cliente se identifica com o evento `session.join`;
//  - não tem rooms, então separamos os eventos por usuário aqui mesmo;
//  - o binding não manda ping, então enviamos o pacote "2" a cada 20s
//    para o cliente não desconectar por timeout.

export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string) || 'wss://realtime.kurio.mock'

type Connection = {
  id: number
  userId: string | null
  io: ReturnType<typeof toSocketIo>
  close: () => void
  ping: ReturnType<typeof setInterval>
}

const connections = new Map<number, Connection>()
let lastConnectionId = 0
// quando true, recusa novas conexões (simula o servidor fora do ar)
let refuseConnections = false
// histórico para os cenários de duplicata/evento antigo
const history: Array<NftUpdatedEvent | OrderUpdatedEvent> = []

// o MSW remove o prefixo /socket.io/ do caminho ao comparar conexões
const link = ws.link(SOCKET_URL)

export const realtimeHandler = link.addEventListener('connection', (connection) => {
  const io = toSocketIo(connection)
  if (refuseConnections) {
    // fecha logo depois do handshake; se fechar antes, o socket.io-client para de tentar reconectar
    setTimeout(() => connection.client.close(), 30)
    return
  }

  lastConnectionId++
  const id = lastConnectionId
  const conn: Connection = {
    id,
    userId: null,
    io,
    close: () => connection.client.close(),
    ping: setInterval(() => connection.client.send('2'), 20_000),
  }
  connections.set(id, conn)

  io.client.on('session.join', (_event, info: { token: string | null }) => {
    const user = info?.token ? sessionUser(info.token) : null
    conn.userId = user?.id ?? null
    io.client.emit('session.joined', { userId: conn.userId })
  })

  connection.client.addEventListener('close', () => {
    clearInterval(conn.ping)
    connections.delete(id)
  })
})

function buildEventId(kind: string, resourceId: string, version: number) {
  return `${kind}:${resourceId}:v${version}`
}

export function broadcastNftUpdated(nftId: string) {
  const nft = db.state.nfts[nftId]
  if (!nft) return
  const event: NftUpdatedEvent = {
    eventId: buildEventId('nft.updated', nft.id, nft.version),
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: new Date().toISOString(),
    payload: { price: nft.price, previousPrice: nft.previousPrice, available: nft.available, editions: nft.editions },
  }
  history.push(event)
  for (const conn of connections.values()) {
    conn.io.client.emit('nft.updated', event)
  }
}

export function sendOrderUpdated(orderId: string) {
  const order = db.state.orders[orderId]
  if (!order) return
  // tira os campos internos antes de mandar para o cliente
  const { userId, requestHash: _requestHash, quoteId: _quoteId, resolveAt: _resolveAt, outcome: _outcome, ...publicOrder } = order
  const event: OrderUpdatedEvent = {
    eventId: buildEventId('order.updated', order.id, order.version),
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: new Date().toISOString(),
    payload: { status: order.status, order: publicOrder },
  }
  history.push(event)
  // o evento de pedido só vai para o dono do pedido
  for (const conn of connections.values()) {
    if (conn.userId === userId) conn.io.client.emit('order.updated', event)
  }
}

// reenvia o último evento ("duplicate") ou um evento com versão anterior ("stale")
export function replayEvent(mode: 'duplicate' | 'stale', resourceId?: string): boolean {
  const events = history.filter((item) => !resourceId || item.resource.id === resourceId)
  const last = events.at(-1)
  if (!last) return false

  let event = last
  if (mode === 'stale') {
    const olderEvents = events.filter((item) => item.resource.id === last.resource.id && item.version < last.version)
    const older = olderEvents.at(-1)
    if (!older) return false
    event = older
  }

  for (const conn of connections.values()) {
    if (event.type === 'order.updated') {
      const owner = db.state.orders[event.resource.id]?.userId
      if (conn.userId !== owner) continue
    }
    conn.io.client.emit(event.type, event as never)
  }
  return true
}

// derruba todas as conexões; com holdMs, também recusa reconexões durante esse tempo
export function dropConnections(holdMs = 0) {
  if (holdMs > 0) {
    refuseConnections = true
    setTimeout(() => {
      refuseConnections = false
    }, holdMs)
  }
  for (const conn of [...connections.values()]) {
    conn.close()
  }
}

export function connectionCount() {
  return connections.size
}

export function resetRealtime() {
  history.length = 0
  refuseConnections = false
}
