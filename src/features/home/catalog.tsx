import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react'
import type { CatalogSort, CatalogTab } from '@/api/contracts'
import { useCatalog } from '@/api/queries'
import { catalogSearchSchema, toListParams, type CatalogSearch } from '@/app/search'
import { NftCard } from '@/components/nft/nft-card'
import { EmptyState, ErrorState } from '@/components/feedback'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatEth } from '@/lib/eth'
import { CatalogFilters } from './catalog-filters'

const TABS: Array<{ value: CatalogTab; label: string }> = [
  { value: 'todos', label: 'Todos os NFTs' },
  { value: 'novos', label: 'Novos lançamentos' },
  { value: 'em-alta', label: 'Em alta' },
]
const SORTS: Array<{ value: CatalogSort; label: string }> = [
  { value: 'recentes', label: 'Listados recentemente' },
  { value: 'preco-asc', label: 'Menor preço' },
  { value: 'preco-desc', label: 'Maior preço' },
  { value: 'nome', label: 'Nome (A–Z)' },
]

export function CardSkeleton() {
  return (
    <div data-testid="nft-card-skeleton">
      <div className="rounded-[var(--radius-card)] bg-surface p-3">
        <Skeleton className="aspect-square w-full rounded-[10px]" />
      </div>
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-1.5 h-4 w-1/3" />
    </div>
  )
}

// mostra a primeira, a última e as páginas ao redor da atual. Ex.: 1 … 4 5 6 … 10
function getPageNumbers(page: number, totalPages: number): Array<number | 'gap'> {
  const pages: number[] = []
  for (let number = 1; number <= totalPages; number++) {
    const isNearCurrent = number >= page - 1 && number <= page + 1
    if (totalPages <= 5 || number === 1 || number === totalPages || isNearCurrent) {
      pages.push(number)
    }
  }

  const result: Array<number | 'gap'> = []
  pages.forEach((number, index) => {
    if (index > 0 && number - pages[index - 1] > 1) result.push('gap')
    result.push(number)
  })
  return result
}

function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null
  const linkClass = (active: boolean) =>
    cn('grid size-7 place-items-center rounded text-xs', active ? 'bg-accent font-bold text-accent-ink' : 'bg-surface hover:bg-surface-2')
  return (
    <nav aria-label="Paginação do catálogo" className="mt-10 flex justify-end">
      <ul className="flex items-center gap-1.5">
        <li>
          {page > 1 ? (
            <Link from="/" to="/" search={(prev: CatalogSearch) => ({ ...prev, page: page - 1 })} hash="catalogo" className={linkClass(false)} aria-label="Página anterior">
              <ChevronLeft className="size-3.5" aria-hidden />
            </Link>
          ) : null}
        </li>
        {getPageNumbers(page, totalPages).map((number, index) =>
          number === 'gap' ? (
            <li key={`gap-${index}`} aria-hidden className="px-1 text-xs">
              …
            </li>
          ) : (
            <li key={number}>
              <Link
                from="/"
                to="/"
                search={(prev: CatalogSearch) => ({ ...prev, page: number === 1 ? undefined : number })}
                hash="catalogo"
                className={linkClass(number === page)}
                aria-label={`Página ${number}`}
                aria-current={number === page ? 'page' : undefined}
              >
                {number}
              </Link>
            </li>
          ),
        )}
        <li>
          {page < totalPages ? (
            <Link from="/" to="/" search={(prev: CatalogSearch) => ({ ...prev, page: page + 1 })} hash="catalogo" className={linkClass(false)} aria-label="Próxima página">
              <ChevronRight className="size-3.5" aria-hidden />
            </Link>
          ) : null}
        </li>
      </ul>
    </nav>
  )
}

function MobileSearch({ value, onCommit }: { value: string | undefined; onCommit: (q: string | undefined) => void }) {
  const [term, setTerm] = useState(value ?? '')

  useEffect(() => setTerm(value ?? ''), [value])

  // espera o usuário parar de digitar antes de buscar
  useEffect(() => {
    const timer = setTimeout(() => {
      const newValue = term.trim() || undefined
      if (newValue !== (value || undefined)) onCommit(newValue)
    }, 350)
    return () => clearTimeout(timer)
  }, [term, value, onCommit])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onCommit(term.trim() || undefined)
  }

  return (
    <form role="search" className="relative flex-1" onSubmit={handleSubmit}>
      <label htmlFor="catalog-search" className="sr-only">
        Buscar no catálogo
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-cream/80" aria-hidden />
      <input
        id="catalog-search"
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Explorar coleções"
        className="h-12 w-full rounded-xl bg-surface pr-3 pl-11 text-sm placeholder:text-subtle"
      />
    </form>
  )
}

export function Catalog() {
  // strict: false porque o catálogo também aparece atrás de outras rotas (ex.: /login)
  const search = catalogSearchSchema.parse(useSearch({ strict: false }))
  const navigate = useNavigate()
  const params = toListParams(search)
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData, isRefetchError } = useCatalog(params)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // mudar qualquer filtro volta para a página 1
  const updateSearch = (changes: Partial<CatalogSearch>) =>
    navigate({ to: '/', search: { ...search, ...changes, page: undefined }, hash: 'catalogo', resetScroll: false })

  const clearAll = () => navigate({ to: '/', search: {}, hash: 'catalogo', resetScroll: false })

  let activeFilters = (search.collections?.length ?? 0) + (search.networks?.length ?? 0)
  if (search.minPrice || search.maxPrice) activeFilters++

  const hasAnyFilter = activeFilters > 0 || !!search.q || (search.tab && search.tab !== 'todos')
  const isUpdating = isFetching && isPlaceholderData

  const sortSelect = (
    <div className="flex items-center gap-2 text-xs">
      <span id="sort-label">Ordenar por:</span>
      <Select value={params.sort} onValueChange={(value) => updateSearch({ sort: value === 'recentes' ? undefined : (value as CatalogSort) })}>
        <SelectTrigger aria-labelledby="sort-label" className="h-8 w-auto gap-1 border-0 bg-transparent px-1 text-xs shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-line bg-surface">
          {SORTS.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-xs">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <section id="catalogo" aria-labelledby="catalog-title" className="container-k scroll-mt-4 pt-6 md:pt-12">
      <h2 id="catalog-title" className="sr-only">
        Catálogo de NFTs
      </h2>

      {/* mobile: busca + filtros em drawer */}
      <div className="mb-4 flex gap-3 md:hidden">
        <MobileSearch value={search.q} onCommit={(q) => updateSearch({ q })} />
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <button type="button" className="relative grid size-12 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink" aria-label={`Filtros${activeFilters ? `, ${activeFilters} ativo(s)` : ''}`}>
              <SlidersHorizontal className="size-5" aria-hidden />
              {activeFilters > 0 && <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-cream text-[10px] font-bold text-ink">{activeFilters}</span>}
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[88vw] max-w-sm overflow-y-auto border-line bg-surface p-5">
            <SheetHeader className="p-0">
              <SheetTitle>Filtros</SheetTitle>
              <SheetDescription className="text-muted">{data ? `${data.total} NFTs encontrados` : 'Carregando…'}</SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-6">
              {sortSelect}
              <CatalogFilters idPrefix="m" search={search} facets={data?.facets} onChange={updateSearch} />
              <Button className="w-full" onClick={() => setFiltersOpen(false)}>
                Ver resultados
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-8 md:grid-cols-[200px_1fr] lg:grid-cols-[220px_1fr]">
        <aside className="hidden md:block" aria-label="Filtros do catálogo">
          <div className="rounded-[var(--radius-card)] bg-surface p-4">
            <CatalogFilters idPrefix="d" search={search} facets={data?.facets} onChange={updateSearch} />
          </div>
          <FeaturedOffer />
        </aside>

        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Seleção do catálogo" className="-mx-1 flex gap-4 overflow-x-auto px-1 md:gap-3">
              {TABS.map((tab) => {
                const active = params.tab === tab.value
                return (
                  <button
                    key={tab.value}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    onClick={() => updateSearch({ tab: tab.value === 'todos' ? undefined : tab.value })}
                    className={cn(
                      'shrink-0 border-b-2 pb-1 text-sm whitespace-nowrap md:text-xs',
                      active ? 'border-accent text-accent' : 'border-transparent text-cream hover:text-accent',
                    )}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
            <div className="hidden md:block">{sortSelect}</div>
          </div>

          {hasAnyFilter && (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
              {search.q && <span className="rounded bg-surface px-2 py-1">Busca: “{search.q}”</span>}
              <button type="button" onClick={clearAll} className="text-accent underline-offset-2 hover:underline">
                Limpar filtros
              </button>
            </div>
          )}

          <p className="sr-only" role="status" aria-live="polite">
            {isPending ? 'Carregando NFTs…' : data ? `${data.total} NFTs encontrados, página ${data.page} de ${data.totalPages}.` : ''}
          </p>

          {isPending ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6" aria-busy="true">
              {Array.from({ length: 9 }, (_, index) => (
                <CardSkeleton key={index} />
              ))}
            </div>
          ) : isError && !data ? (
            <ErrorState title="Não foi possível carregar o catálogo" error={error} onRetry={() => refetch()} retrying={isFetching} />
          ) : data && data.items.length === 0 ? (
            <EmptyState title="Nenhum NFT encontrado">
              <p className="text-sm text-muted">Tente outros termos ou remova filtros.</p>
              <Button variant="outline" onClick={clearAll}>
                Limpar filtros
              </Button>
            </EmptyState>
          ) : data ? (
            <>
              {isRefetchError && (
                <p role="alert" className="mb-3 text-xs text-danger">
                  Falha ao atualizar o catálogo. Exibindo os últimos resultados. <button className="underline" onClick={() => refetch()}>Tentar novamente</button>
                </p>
              )}
              {isUpdating && (
                <p className="mb-3 text-xs text-muted" role="status">
                  Atualizando resultados…
                </p>
              )}
              <div className={cn('grid grid-cols-2 gap-4 transition-opacity lg:grid-cols-3 lg:gap-6', isUpdating && 'opacity-60')} aria-busy={isUpdating}>
                {data.items.map((nft, index) => (
                  <NftCard key={nft.id} nft={nft} priority={index < 3} />
                ))}
              </div>
              <Pagination page={data.page} totalPages={data.totalPages} />
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function FeaturedOffer() {
  const { data } = useCatalog({ tab: 'em-alta', sort: 'preco-desc', page: 1, pageSize: 1 })
  const nft = data?.items[0]
  return (
    <div className="mt-6 overflow-hidden rounded-[var(--radius-card)] bg-surface">
      <p className="px-3 pt-4 text-lg font-bold text-accent">NFT EM DESTAQUE</p>
      <p className="px-3 pb-3 text-center text-sm font-bold">OFERTA LIMITADA</p>
      {nft ? (
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="block" aria-label={`Oferta limitada: ${nft.name}, ${formatEth(nft.price)}`}>
          <img src={nft.image} alt="" width={220} height={220} loading="lazy" className="aspect-square w-full rounded-[var(--radius-card)] object-cover" />
        </Link>
      ) : (
        <Skeleton className="aspect-square w-full" />
      )}
    </div>
  )
}
