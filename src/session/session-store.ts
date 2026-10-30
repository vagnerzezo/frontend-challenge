import type { Session, User } from '@/api/contracts'

// A sessão fica no localStorage (token e usuário, nunca a senha) para continuar
// logado depois do refresh. Ela é validada no servidor quando o app abre.

export type SessionStatus = 'anonymous' | 'authenticated' | 'expired'

export interface SessionState {
  status: SessionStatus
  token: string | null
  user: User | null
  expiresAt: string | null
  // aumenta a cada troca de sessão, para ignorar coisas da sessão anterior
  epoch: number
}

const STORAGE_KEY = 'kurio.session'
const listeners = new Set<() => void>()

function loadFromStorage(): SessionState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const session = JSON.parse(saved) as Session
      if (session.token && session.user) {
        return { status: 'authenticated', token: session.token, user: session.user, expiresAt: session.expiresAt, epoch: 1 }
      }
    }
  } catch {
    // dado inválido no storage, começa deslogado
  }
  return { status: 'anonymous', token: null, user: null, expiresAt: null, epoch: 1 }
}

let state: SessionState = loadFromStorage()

function saveState(next: Omit<SessionState, 'epoch'>, isNewSession: boolean) {
  state = { ...next, epoch: isNewSession ? state.epoch + 1 : state.epoch }

  try {
    if (next.token && next.user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: next.token, user: next.user, expiresAt: next.expiresAt }))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // localStorage indisponível
  }

  listeners.forEach((listener) => listener())
}

export const sessionStore = {
  get: () => state,
  getToken: () => state.token,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  signIn(session: Session) {
    saveState({ status: 'authenticated', token: session.token, user: session.user, expiresAt: session.expiresAt }, true)
  },
  updateUser(user: User) {
    if (state.status !== 'authenticated') return
    saveState({ ...state, user }, false)
  },
  signOut() {
    saveState({ status: 'anonymous', token: null, user: null, expiresAt: null }, true)
  },
  // o servidor avisou que a sessão expirou: limpa os dados mas guarda o motivo
  expire() {
    if (state.status !== 'authenticated') return
    saveState({ status: 'expired', token: null, user: null, expiresAt: null }, true)
  },
}
