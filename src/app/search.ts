import { z } from 'zod'
import type { NftListParams } from '@/api/contracts'

// Os filtros do catálogo ficam na URL para não se perderem ao recarregar a página.

// aceita "a,b,c" ou uma lista e mantém só os valores permitidos
function listParam<T extends string>(allowedValues: readonly [T, ...T[]]) {
  return z
    .union([z.array(z.string()), z.string()])
    .transform((value) => {
      const list = Array.isArray(value) ? value : value.split(',')
      return list.filter((item): item is T => (allowedValues as readonly string[]).includes(item))
    })
    .optional()
    .catch(undefined)
}

const priceParam = z
  .union([z.string(), z.number()])
  .transform(String)
  .pipe(z.string().regex(/^\d+(\.\d+)?$/))
  .optional()
  .catch(undefined)

export const catalogSearchSchema = z.object({
  q: z.string().trim().max(60).optional().catch(undefined),
  collections: listParam(['arte-digital', 'fotografia', 'musica', 'arte-3d', 'colecionaveis', 'generativa', 'jogos', 'assinaturas', 'utilidade']),
  networks: listParam(['ethereum', 'polygon', 'solana']),
  minPrice: priceParam,
  maxPrice: priceParam,
  tab: z.enum(['todos', 'novos', 'em-alta']).optional().catch(undefined),
  sort: z.enum(['recentes', 'preco-asc', 'preco-desc', 'nome']).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
})

export type CatalogSearch = z.infer<typeof catalogSearchSchema>

export const PAGE_SIZE = 9

export function toListParams(search: CatalogSearch): NftListParams {
  return {
    q: search.q || undefined,
    collections: search.collections?.length ? search.collections : undefined,
    networks: search.networks?.length ? search.networks : undefined,
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    tab: search.tab ?? 'todos',
    sort: search.sort ?? 'recentes',
    page: search.page ?? 1,
    pageSize: PAGE_SIZE,
  }
}

// só permite redirecionar para páginas do próprio site
export function safeRedirect(target: string | undefined): string {
  if (!target || !target.startsWith('/') || target.startsWith('//')) return '/'
  return target
}

export const authSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
  reason: z.enum(['expired']).optional().catch(undefined),
})
