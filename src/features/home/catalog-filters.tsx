import { useEffect, useState } from 'react'
import type { NftListResponse } from '@/api/contracts'
import type { CatalogSearch } from '@/app/search'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface Props {
  search: CatalogSearch
  facets: NftListResponse['facets'] | undefined
  onChange: (patch: Partial<CatalogSearch>) => void
  idPrefix: string
}

// adiciona o valor se não estiver na lista, ou remove se já estiver
function toggleValue<T extends string>(list: T[] | undefined, value: T): T[] | undefined {
  const current = list ?? []
  const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
  return next.length > 0 ? next : undefined
}

function formatPrice(value: number) {
  return value.toFixed(2).replace('.', ',')
}

function FacetList<T extends string>({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string
  items: Array<{ value: T; label: string; count: number }> | undefined
  selected: T[] | undefined
  onToggle: (value: T) => void
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-bold">{title}</legend>
      <ul className="space-y-1">
        {items
          ? items.map((item) => {
              const isSelected = !!selected?.includes(item.value)
              return (
                <li key={item.value}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onToggle(item.value)}
                    className={cn(
                      'flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-surface-2',
                      isSelected ? 'bg-surface-2 font-bold text-accent-strong' : 'text-muted',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span aria-hidden className={cn('size-2 rounded-sm border border-accent', isSelected && 'bg-accent')} />
                      {item.label}
                    </span>
                    <span className="tabular-nums">({item.count})</span>
                  </button>
                </li>
              )
            })
          : Array.from({ length: 5 }, (_, index) => (
              <li key={index}>
                <Skeleton className="h-6 w-full" />
              </li>
            ))}
      </ul>
    </fieldset>
  )
}

export function CatalogFilters({ search, facets, onChange, idPrefix }: Props) {
  const min = Number(facets?.priceRange.min ?? 0)
  const max = Number(facets?.priceRange.max ?? 0)
  const [range, setRange] = useState<[number, number]>([Number(search.minPrice ?? min), Number(search.maxPrice ?? max)])

  useEffect(() => {
    setRange([Number(search.minPrice ?? min), Number(search.maxPrice ?? max)])
  }, [search.minPrice, search.maxPrice, min, max])

  return (
    <div className="space-y-7">
      <FacetList
        title="Coleções"
        items={facets?.collections}
        selected={search.collections}
        onToggle={(value) => onChange({ collections: toggleValue(search.collections, value) })}
      />
      <fieldset>
        <legend className="mb-3 text-sm font-bold">Faixa de preço</legend>
        {facets ? (
          <>
            <Slider
              min={min}
              max={max}
              step={0.01}
              value={range}
              onValueChange={(value) => setRange([value[0], value[1]])}
              aria-label="Faixa de preço em ETH"
              thumbLabels={['Preço mínimo', 'Preço máximo']}
              className="px-1"
            />
            <p id={`${idPrefix}-price`} className="mt-3 text-xs" aria-live="polite">
              Preço: {formatPrice(range[0])} - {formatPrice(range[1])} ETH
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                aria-describedby={`${idPrefix}-price`}
                className="rounded bg-accent px-2.5 py-1 text-xs font-bold text-accent-ink hover:bg-accent-strong"
                onClick={() =>
                  onChange({
                    minPrice: range[0] > min ? range[0].toFixed(2) : undefined,
                    maxPrice: range[1] < max ? range[1].toFixed(2) : undefined,
                  })
                }
              >
                Aplicar
              </button>
              {(search.minPrice || search.maxPrice) && (
                <button type="button" className="text-xs text-accent underline-offset-2 hover:underline" onClick={() => onChange({ minPrice: undefined, maxPrice: undefined })}>
                  Limpar preço
                </button>
              )}
            </div>
          </>
        ) : (
          <Skeleton className="h-16 w-full" />
        )}
      </fieldset>
      <FacetList
        title="Rede"
        items={facets?.networks}
        selected={search.networks}
        onToggle={(value) => onChange({ networks: toggleValue(search.networks, value) })}
      />
    </div>
  )
}
