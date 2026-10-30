import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useCatalog } from '@/api/queries'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const FEATURED_PARAMS = { tab: 'em-alta', sort: 'recentes', page: 1, pageSize: 3 } as const

function Dots({ count, active, onSelect, className }: { count: number; active: number; onSelect: (index: number) => void; className?: string }) {
  return (
    <div className={cn('flex', className)} role="group" aria-label="Destaques">
      {Array.from({ length: count }, (_, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onSelect(index)}
          aria-label={`Destaque ${index + 1} de ${count}`}
          aria-pressed={index === active}
          className="group grid size-6 place-items-center"
        >
          <span aria-hidden className={cn('size-2 rounded-full transition-colors', index === active ? 'bg-accent' : 'bg-accent/40 group-hover:bg-accent/70')} />
        </button>
      ))}
    </div>
  )
}

export function Hero() {
  const { data, isPending } = useCatalog(FEATURED_PARAMS)
  const [index, setIndex] = useState(0)
  const items = data?.items ?? []
  const current = items[index] ?? items[0]

  return (
    <section aria-label="Destaques">
      {/* desktop / tablet */}
      <div className="container-k hidden items-center gap-10 py-8 md:grid md:grid-cols-[1fr_minmax(0,420px)] lg:grid-cols-[1fr_480px]">
        <div className="max-w-xl">
          <p className="text-xs font-medium tracking-wide">Bem-vindo à Kurio</p>
          <h1 className="mt-4 text-3xl leading-[1.35] font-bold tracking-wide lg:text-[40px]">
            SEJA DONO DO FUTURO
            <br />
            DA ARTE DIGITAL
          </h1>
          <p className="mt-4 max-w-md text-xs leading-relaxed text-muted lg:text-sm">
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.
          </p>
          <div className="mt-8 flex items-center gap-8">
            <Link to="/" hash="catalogo" className="inline-flex h-9 items-center rounded-md bg-accent px-5 text-sm font-bold text-accent-ink hover:bg-accent-strong">
              EXPLORAR
            </Link>
            {items.length > 1 && <Dots count={items.length} active={index} onSelect={setIndex} className="ml-auto" />}
          </div>
        </div>
        <div className="aspect-square w-full">
          {isPending || !current ? (
            <Skeleton className="size-full rounded-2xl" />
          ) : (
            <Link to="/nft/$nftId" params={{ nftId: current.id }} aria-label={`Ver destaque ${current.name}`}>
              <img
                src={current.image}
                alt={`Arte do NFT em destaque ${current.name}`}
                width={480}
                height={480}
                fetchPriority="high"
                className="size-full rounded-2xl object-cover"
              />
            </Link>
          )}
        </div>
      </div>

      {/* mobile */}
      <div className="px-4 pt-3 md:hidden">
        <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_30%_30%,#6b4630_0%,#3a271c_45%,#2a1d16_100%)] p-4">
          <div className="grid grid-cols-[1fr_140px] gap-3">
            <div>
              <p className="text-xs">Bem-vindo à Kurio</p>
              <h1 className="mt-2 text-lg leading-snug font-bold">
                SEJA DONO DA
                <br />
                CULTURA DIGITAL
              </h1>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">Descubra NFTs selecionados de criadores do mundo todo.</p>
              <Link to="/" hash="catalogo" className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-accent">
                EXPLORAR <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
            <div className="aspect-square self-center">
              {isPending || !current ? (
                <Skeleton className="size-full rounded-2xl" />
              ) : (
                <img src={current.image} alt={`Arte do NFT em destaque ${current.name}`} width={140} height={140} className="size-full rounded-2xl object-cover" />
              )}
            </div>
          </div>
          {items.length > 1 && <Dots count={items.length} active={index} onSelect={setIndex} className="mt-3 justify-center" />}
        </div>
      </div>
    </section>
  )
}
