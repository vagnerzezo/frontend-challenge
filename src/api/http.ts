import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { ApiErrorBody, ApiErrorCode } from './contracts'
import { sessionStore } from '@/session/session-store'
import { getGuestCartId } from '@/session/guest-cart'

export const HTTP_TIMEOUT_MS = Number(import.meta.env.VITE_HTTP_TIMEOUT_MS) || 10_000

export class ApiError extends Error {
  status: number
  code: ApiErrorCode | 'NETWORK' | 'TIMEOUT' | 'CANCELED'
  fields?: Record<string, string>
  details?: Record<string, unknown>

  constructor(
    status: number,
    code: ApiErrorCode | 'NETWORK' | 'TIMEOUT' | 'CANCELED',
    message: string,
    fields?: Record<string, string>,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
    this.details = details
  }

  // erros que vale a pena tentar de novo
  get transient() {
    return this.code === 'NETWORK' || this.code === 'TIMEOUT' || this.code === 'TRANSIENT' || this.status >= 500
  }
}

export const http = axios.create({ baseURL: '/api', headers: { Accept: 'application/json' } })

type RequestConfig = InternalAxiosRequestConfig & { timeoutId?: ReturnType<typeof setTimeout>; timedOut?: boolean }

http.interceptors.request.use((config: RequestConfig) => {
  const token = sessionStore.getToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  config.headers.set('X-Cart-Id', getGuestCartId())

  // O timeout é feito com setTimeout (e não com o timeout do axios)
  // para que os testes consigam controlar o relógio.
  const controller = new AbortController()
  const originalSignal = config.signal as AbortSignal | undefined
  if (originalSignal) {
    if (originalSignal.aborted) controller.abort()
    else originalSignal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  config.timeoutId = setTimeout(() => {
    config.timedOut = true
    controller.abort()
  }, config.timeout || HTTP_TIMEOUT_MS)
  config.timeout = 0
  config.signal = controller.signal
  return config
})

http.interceptors.response.use(
  (response) => {
    clearTimeout((response.config as RequestConfig).timeoutId)
    return response
  },
  (error: AxiosError<ApiErrorBody>) => {
    const config = error.config as RequestConfig | undefined
    if (config) clearTimeout(config.timeoutId)

    if (config?.timedOut) {
      return Promise.reject(new ApiError(0, 'TIMEOUT', 'A requisição demorou demais. Verificando…'))
    }
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      return Promise.reject(new ApiError(0, 'CANCELED', 'Requisição cancelada.'))
    }
    if (!error.response) {
      return Promise.reject(new ApiError(0, 'NETWORK', 'Sem conexão com o servidor. Verifique sua rede.'))
    }

    const { status, data } = error.response
    const body = data?.error
    const apiError = new ApiError(
      status,
      body?.code ?? (status >= 500 ? 'INTERNAL' : 'VALIDATION_ERROR'),
      body?.message ?? 'Erro inesperado.',
      body?.fields,
      body?.details,
    )

    // se a sessão expirou no meio da navegação, avisa o session store
    const isSessionError = apiError.code === 'SESSION_EXPIRED' || apiError.code === 'UNAUTHENTICATED'
    if (status === 401 && isSessionError && sessionStore.getToken()) {
      sessionStore.expire()
    }
    return Promise.reject(apiError)
  },
)

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
