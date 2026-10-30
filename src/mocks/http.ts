import { delay, HttpResponse, type DefaultBodyType, type HttpResponseResolver, type PathParams } from 'msw'
import type { ApiErrorBody, ApiErrorCode } from '@/api/contracts'
import { getConfig } from './config'

// Erro lançado pelos handlers; vira uma resposta { error } no formato da API
export class MockHttpError extends Error {
  status: number
  code: ApiErrorCode
  fields?: Record<string, string>
  details?: Record<string, unknown>

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    fields?: Record<string, string>,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
    this.details = details
  }
}

export function fail(
  status: number,
  code: ApiErrorCode,
  message: string,
  fields?: Record<string, string>,
  details?: Record<string, unknown>,
): never {
  throw new MockHttpError(status, code, message, fields, details)
}

export function errorResponse(error: MockHttpError) {
  const body: ApiErrorBody = { error: { code: error.code, message: error.message, fields: error.fields, details: error.details } }
  return HttpResponse.json(body, { status: error.status })
}

// gera um número a partir do texto, para a mesma URL sempre ter o mesmo atraso
function textToNumber(text: string) {
  let result = 2166136261
  for (let i = 0; i < text.length; i++) {
    result = Math.imul(result ^ text.charCodeAt(i), 16777619)
  }
  return result >>> 0
}

let requestCount = 0

async function applyLatency(request: Request) {
  const { latency } = getConfig()
  if (latency === 'none') return
  if (latency === 'slow') return delay(2500)
  if (latency === 'fast') return delay(120 + (textToNumber(request.url) % 230))
  return delay(100 + (textToNumber(request.url) % 1900))
}

// Aplica as condições de rede simuladas (offline, servidor fora do ar e latência) antes do handler
export function withNetwork<P extends PathParams, B extends DefaultBodyType>(
  resolver: (info: Parameters<HttpResponseResolver<P, B>>[0] & { seq: number }) => Promise<Response> | Response,
): HttpResponseResolver<P, B> {
  return async (info) => {
    requestCount++
    const seq = requestCount
    const config = getConfig()
    if (config.offline) return HttpResponse.error()

    await applyLatency(info.request)
    if (config.serverDown) {
      return errorResponse(new MockHttpError(503, 'TRANSIENT', 'Serviço temporariamente indisponível. Tente novamente.'))
    }
    try {
      return await resolver({ ...info, seq })
    } catch (error) {
      if (error instanceof MockHttpError) return errorResponse(error)
      console.error('[mocks] erro inesperado', error)
      return errorResponse(new MockHttpError(500, 'INTERNAL', 'Erro interno inesperado.'))
    }
  }
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    return fail(422, 'VALIDATION_ERROR', 'Corpo da requisição inválido.')
  }
}
