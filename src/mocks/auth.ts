import type { Session, User } from '@/api/contracts'
import { db, type UserRecord } from './db'
import { fail } from './http'

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000

export function toUser(user: UserRecord): User {
  return { id: user.id, username: user.username, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl }
}

// retorna o usuário do token, ou null se o token não for válido
export function sessionUser(token: string): UserRecord | null {
  const session = db.state.sessions[token]
  if (!session || session.expiresAt <= Date.now()) return null
  return db.state.users[session.userId] ?? null
}

export function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}

// retorna o usuário logado ou responde 401
export function requireUser(request: Request): UserRecord {
  const token = bearerToken(request)
  if (!token) return fail(401, 'UNAUTHENTICATED', 'Entre para continuar.')

  const session = db.state.sessions[token]
  if (!session) return fail(401, 'UNAUTHENTICATED', 'Sessão inválida. Entre novamente.')
  if (session.expiresAt <= Date.now()) return fail(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.')

  return db.state.users[session.userId] ?? fail(401, 'UNAUTHENTICATED', 'Sessão inválida.')
}

// sem token retorna null; com token expirado também responde 401 para o cliente perceber
export function optionalUser(request: Request): UserRecord | null {
  return bearerToken(request) ? requireUser(request) : null
}

// o carrinho pertence ao usuário logado ou ao visitante (pelo header X-Cart-Id)
export function cartOwnerKey(request: Request): string {
  const user = optionalUser(request)
  if (user) return `user:${user.id}`
  const guest = request.headers.get('x-cart-id')
  if (!guest || !/^[a-zA-Z0-9-]{8,64}$/.test(guest)) return fail(422, 'VALIDATION_ERROR', 'Cabeçalho X-Cart-Id ausente.')
  return `guest:${guest}`
}

export function createSession(userId: string): Session {
  const token = crypto.randomUUID()
  const expiresAt = Date.now() + SESSION_DURATION_MS
  db.state.sessions[token] = { userId, expiresAt }
  db.save()
  return { token, user: toUser(db.state.users[userId]), expiresAt: new Date(expiresAt).toISOString() }
}
