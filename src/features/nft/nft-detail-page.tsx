import { useEffect, useState, type ReactNode } from 'react'
import { getRouteApi, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft, Mail, Search, ShoppingCart, Star } from 'lucide-react'
import { toast } from 'sonner'
import type { Edition, Nft } from '@/api/contracts'
import { useAddToCart, useCart, useCatalog, useNft } from '@/api/queries'
import { isApiError } from '@/api/http'
import { Breadcrumb, ErrorState } from '@/components/feedback'
import { FavoriteButton } from '@/components/nft/favorite-button'
import { QuantityStepper } from '@/components/nft/quantity-stepper'
import { NftCard } from '@/components/nft/nft-card'
import { LinkedinIcon, TwitterIcon } from '@/components/layout/brand-icons'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ethMul, formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { CardSkeleton } from '@/features/home/catalog'

const route = getRouteApi('/nft/$nftId')
const MAX_PER_ORDER = 10

// usa a edição 1-50 se tiver estoque, senão a primeira que tiver
function getDefaultEdition(nft: Nft): Edition | undefined {
  const firstEdition = nft.editions.find((edition) => edition.id === '1-50' && edition.available > 0)
  if (firstEdition) return firstEdition
  return nft.editions.find((edition) => edition.available > 0)
}

const NETWORK_NAMES = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5 text-accent" aria-hidden>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} className="size-3.5" fill={index < Math.round(rating) ? 'currentColor' : 'none'} />
      ))}
    </span>
  )
}

function DetailSkeleton() {
  return (
    <div className="container-k" aria-busy="true" data-testid="nft-detail-skeleton">
      <span className="sr-only" role="status">
        Carregando NFT…
      </span>
      <Skeleton className="my-4 h-4 w-32" />
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-[72px_1fr] gap-4">
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="aspect-square w-full" />
            ))}
          </div>
          <Skeleton className="aspect-square w-full rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-8 w-60" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  )
}

function MoreFromCollection({ nft }: { nft: Nft }) {
  const { data, isPending } = useCatalog({ collections: [nft.collection], page: 1, pageSize: 9 })
  const otherNfts = useCatalog({ page: 1, pageSize: 9, sort: 'preco-desc' })

  let items = (data?.items ?? []).filter((item) => item.id !== nft.id)
  // se a coleção tiver poucos itens, completa com outros NFTs
  if (items.length < 3) {
    const extra = (otherNfts.data?.items ?? []).filter((item) => item.id !== nft.id && !items.some((own) => own.id === item.id))
    items = [...items, ...extra].slice(0, 8)
  }
  return (
    <section aria-labelledby="more-title" className="mt-16">
      <h2 id="more-title" className="border-b border-line pb-2 text-sm font-bold text-accent">
        Mais desta coleção
      </h2>
      <ScrollRow loading={isPending}>
        {items.map((item) => (
          <NftCard key={item.id} nft={item} className="w-[44vw] shrink-0 snap-start sm:w-[200px]" />
        ))}
      </ScrollRow>
    </section>
  )
}

// carrossel com rolagem horizontal e bolinhas mostrando a posição
export function ScrollRow({ children, loading }: { children: ReactNode; loading?: boolean }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    if (!container) return

    const updatePages = () => {
      setTotalPages(Math.max(1, Math.ceil(container.scrollWidth / container.clientWidth)))
      setPage(Math.round(container.scrollLeft / container.clientWidth))
    }

    updatePages()
    container.addEventListener('scroll', updatePages, { passive: true })
    window.addEventListener('resize', updatePages)
    return () => {
      container.removeEventListener('scroll', updatePages)
      window.removeEventListener('resize', updatePages)
    }
  }, [container, children])

  return (
    <>
      <div ref={setContainer} className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none]" tabIndex={0} aria-label="Lista rolável de NFTs">
        {loading
          ? Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="w-[44vw] shrink-0 sm:w-[200px]">
                <CardSkeleton />
              </div>
            ))
          : children}
      </div>
      {totalPages > 1 && (
        <div className="mt-3 flex justify-center" role="group" aria-label="Posição do carrossel">
          {Array.from({ length: totalPages }, (_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Ir para grupo ${index + 1} de ${totalPages}`}
              aria-pressed={index === page}
              onClick={() => container?.scrollTo({ left: index * container.clientWidth, behavior: 'smooth' })}
              className="grid size-6 place-items-center"
            >
              <span aria-hidden className={cn('size-2.5 rounded-full border border-accent', index === page && 'bg-accent')} />
            </button>
          ))}
        </div>
      )}
    </>
  )
}

export function NftDetailPage() {
  const { nftId } = route.useParams()
  const { data: nft, isPending, isError, error, refetch, isFetching } = useNft(nftId)
  const navigate = useNavigate()
  const router = useRouter()
  const { data: cart } = useCart()
  const add = useAddToCart()
  const [editionId, setEditionId] = useState<string | null>(null)
  const [selectedQuantity, setSelectedQuantity] = useState(1)
  const [imageIndex, setImageIndex] = useState(0)
  const [isZoomOpen, setIsZoomOpen] = useState(false)

  // volta ao estado inicial quando troca de NFT
  useEffect(() => {
    setEditionId(null)
    setSelectedQuantity(1)
    setImageIndex(0)
  }, [nftId])

  useEffect(() => {
    if (nft) document.title = `${nft.name} — Kurio`
    return () => {
      document.title = 'Kurio — Marketplace de NFTs'
    }
  }, [nft])

  if (isPending) return <DetailSkeleton />
  if (isError) {
    if (isApiError(error) && error.code === 'NOT_FOUND') {
      return (
        <div className="container-k flex min-h-[50vh] flex-col items-center justify-center gap-4 py-16 text-center">
          <h1 className="text-xl font-bold">NFT não encontrado</h1>
          <p className="text-sm text-muted">O NFT “{nftId}” não existe ou foi removido do mercado.</p>
          <Link to="/" hash="catalogo" className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-accent-ink">
            Explorar o mercado
          </Link>
        </div>
      )
    }
    return (
      <div className="container-k py-10">
        <ErrorState title="Não foi possível carregar o NFT" error={error} onRetry={() => refetch()} retrying={isFetching} />
      </div>
    )
  }

  const edition = nft.editions.find((item) => item.id === editionId) ?? getDefaultEdition(nft)
  const cartItem = cart?.items.find((item) => item.nftId === nft.id && item.editionId === edition?.id)
  const inCart = cartItem?.quantity ?? 0

  // o máximo é o que ainda tem em estoque (descontando o que já está no carrinho), até 10 por pedido
  let maxQuantity = 0
  if (edition) {
    maxQuantity = Math.max(0, Math.min(edition.available - inCart, MAX_PER_ORDER))
  }
  const quantity = Math.min(selectedQuantity, Math.max(1, maxQuantity))
  const soldOut = !edition || maxQuantity === 0
  const shareUrl = window.location.href

  const addToCart = (goToCart: boolean) => {
    if (!edition) return
    add.mutate(
      { nftId: nft.id, editionId: edition.id, quantity, name: nft.name },
      {
        onSuccess: () => {
          setSelectedQuantity(1)
          if (goToCart) {
            navigate({ to: '/carrinho' })
          } else {
            toast.success(`${quantity}× ${nft.name} (${edition.label}) adicionado ao carrinho.`)
          }
        },
        onError: (error) => toast.error(isApiError(error) ? error.message : 'Não foi possível adicionar ao carrinho.'),
      },
    )
  }

  let stockMessage: string
  if (soldOut) {
    stockMessage = inCart > 0 ? 'Você já tem todas as unidades disponíveis desta edição no carrinho.' : 'Edição indisponível. Escolha outra edição.'
  } else {
    stockMessage = `${edition.available} disponível(is) nesta edição`
    if (inCart) stockMessage += ` · ${inCart} no carrinho`
    stockMessage += ` · máx. ${MAX_PER_ORDER} por pedido`
  }

  const editionChips = (
    <fieldset>
      <legend className="mb-2 text-sm font-bold">Edição:</legend>
      <div className="flex flex-wrap gap-2">
        {nft.editions.map((item) => {
          const unavailable = item.available === 0
          const active = edition?.id === item.id
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              disabled={unavailable}
              onClick={() => {
                setEditionId(item.id)
                setSelectedQuantity(1)
              }}
              aria-label={`Edição ${item.label}${unavailable ? ', esgotada' : `, ${item.available} disponível(is)`}`}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs uppercase',
                active ? 'border-accent text-accent-strong' : 'border-line text-muted hover:border-accent/60',
                unavailable && 'cursor-not-allowed line-through opacity-50',
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-muted" aria-live="polite">
        {stockMessage}
      </p>
    </fieldset>
  )

  return (
    <div className="pb-44 md:pb-0">
      <div className="flex items-center justify-between px-4 pt-4 md:hidden">
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) router.history.back()
            else navigate({ to: '/' })
          }}
          className="grid size-10 place-items-center rounded-full bg-surface"
          aria-label="Voltar"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <FavoriteButton nftId={nft.id} name={nft.name} className="size-10 bg-surface" />
      </div>

      <div className="container-k">
        <div className="hidden md:block">
          <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/' }, { label: nft.name }]} />
        </div>
        <div className="mt-4 grid gap-8 md:mt-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
          <div className="grid gap-4 md:grid-cols-[72px_1fr]">
            <ul className="order-2 flex gap-3 md:order-1 md:flex-col" aria-label="Galeria">
              {nft.gallery.map((src, index) => (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => setImageIndex(index)}
                    aria-label={`Imagem ${index + 1} de ${nft.gallery.length}`}
                    aria-pressed={index === imageIndex}
                    className={cn('block w-16 overflow-hidden rounded-md border-2 md:w-full', index === imageIndex ? 'border-accent' : 'border-transparent')}
                  >
                    <img src={src} alt="" width={72} height={72} className="aspect-square w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="relative order-1 rounded-[var(--radius-card)] bg-surface p-3 md:order-2 md:p-4">
              <img
                src={nft.gallery[imageIndex]}
                alt={`Arte do NFT ${nft.name}, imagem ${imageIndex + 1}`}
                width={480}
                height={480}
                fetchPriority="high"
                className="aspect-square w-full rounded-[12px] object-cover"
              />
              <button type="button" onClick={() => setIsZoomOpen(true)} aria-label="Ampliar imagem" className="absolute top-5 right-5 grid size-8 place-items-center rounded-full bg-ink/80 hover:bg-ink">
                <Search className="size-4" aria-hidden />
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-bold md:text-2xl">{nft.name}</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-accent px-2 py-0.5 text-xs md:hidden">
                <Star className="size-3 text-accent" fill="currentColor" aria-hidden /> {nft.rating.toFixed(1)}({nft.reviewsCount})
                <span className="sr-only"> avaliações</span>
              </span>
            </div>
            <div className="mt-2 hidden items-center justify-between border-b border-line pb-2 md:flex">
              <p className="text-lg font-bold text-accent" data-testid="nft-price">
                {formatEth(edition?.price ?? nft.price)}
                {nft.previousPrice && <s className="ml-2 text-sm font-normal text-subtle">{formatEth(nft.previousPrice)}</s>}
              </p>
              <p className="flex items-center gap-1.5 text-xs">
                <Stars rating={nft.rating} />
                <span>
                  <span className="sr-only">Nota {nft.rating.toFixed(1)} de 5, </span>
                  {nft.reviewsCount} avaliações de colecionadores
                </span>
              </p>
            </div>
            <h2 className="mt-5 hidden text-sm font-bold md:block">Sobre este NFT:</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted md:text-xs">{nft.description}</p>
            <div className="mt-4">{editionChips}</div>

            <div className="mt-5 hidden flex-wrap items-center gap-4 md:flex">
              <QuantityStepper value={quantity} max={maxQuantity} onChange={setSelectedQuantity} label="Quantidade" disabled={soldOut} />
              <div className="ml-auto flex gap-3">
                <button
                  type="button"
                  disabled={soldOut || add.isPending}
                  onClick={() => addToCart(true)}
                  className="h-9 rounded-md bg-accent px-8 text-xs font-bold text-accent-ink hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {add.isPending ? 'ADICIONANDO…' : 'COMPRAR'}
                </button>
                <FavoriteButton nftId={nft.id} name={nft.name} variant="button" />
              </div>
            </div>

            <dl className="mt-5 space-y-2 text-sm text-muted md:text-xs">
              <div>
                <dt className="inline">ID do token: </dt>
                <dd className="inline">{nft.tokenId}</dd>
              </div>
              <div>
                <dt className="inline">Coleção: </dt>
                <dd className="inline">{nft.collectionName}</dd>
              </div>
              <div>
                <dt className="inline">Atributos: </dt>
                <dd className="inline">{nft.attributes.join(', ')}</dd>
              </div>
            </dl>
            <div className="mt-4 hidden items-center gap-3 text-xs font-bold md:flex">
              Compartilhar este NFT:
              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no LinkedIn (nova aba)">
                <LinkedinIcon className="size-4" />
              </a>
              <a href={`mailto:?subject=${encodeURIComponent(nft.name)}&body=${encodeURIComponent(shareUrl)}`} aria-label="Compartilhar por e-mail">
                <Mail className="size-4" aria-hidden />
              </a>
              <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(nft.name)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no Twitter (nova aba)">
                <TwitterIcon className="size-4" />
              </a>
            </div>
          </div>
        </div>

        <Tabs defaultValue="detalhes" className="mt-12 hidden md:flex">
          <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b border-line bg-transparent p-0">
            {[
              ['detalhes', 'Detalhes do NFT'],
              ['avaliacoes', `Avaliações de colecionadores (${nft.reviewsCount})`],
            ].map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-2 text-sm text-cream shadow-none data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:font-bold data-[state=active]:text-accent dark:data-[state=active]:bg-transparent"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="detalhes" className="space-y-4 pt-4 text-xs leading-relaxed text-muted">
            {nft.longDescription.map((paragraph) => (
              <p key={paragraph.slice(0, 20)}>{paragraph}</p>
            ))}
            <div>
              <h3 className="font-bold text-cream">Rede:</h3>
              <p>Cunhado na {NETWORK_NAMES[nft.network]} com procedência imutável e metadados armazenados no IPFS.</p>
            </div>
            <div>
              <h3 className="font-bold text-cream">Contrato:</h3>
              <p>{nft.royalties}</p>
            </div>
            <div>
              <h3 className="font-bold text-cream">Direitos autorais:</h3>
              <p>{nft.contract}</p>
            </div>
          </TabsContent>
          <TabsContent value="avaliacoes" className="pt-4">
            <p className="mb-4 flex items-center gap-2 text-sm">
              <Stars rating={nft.rating} /> {nft.rating.toFixed(1)} de 5 · {nft.reviewsCount} avaliações
            </p>
            <ul className="space-y-3">
              {nft.reviews.map((review) => (
                <li key={review.author} className="rounded-md bg-surface p-3 text-xs">
                  <p className="font-bold">
                    {review.author} <span className="sr-only">nota {review.rating} de 5</span>
                    <Stars rating={review.rating} />
                  </p>
                  <p className="mt-1 text-muted">{review.text}</p>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>

        <MoreFromCollection nft={nft} />
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 rounded-t-3xl bg-surface px-5 pt-4 pb-4 shadow-[0_-8px_24px_rgba(0,0,0,0.45)] md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm">
            Qtd.
            <QuantityStepper value={quantity} max={maxQuantity} onChange={setSelectedQuantity} label="Quantidade" disabled={soldOut} size="sm" />
          </div>
          <p className="text-lg font-bold text-accent" aria-live="polite">
            {formatEth(ethMul(edition?.price ?? nft.price, quantity))}
          </p>
        </div>
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            disabled={soldOut || add.isPending}
            onClick={() => addToCart(true)}
            className="h-12 flex-1 rounded-full bg-gradient-to-r from-accent to-[#a8693e] text-sm font-bold text-accent-ink disabled:opacity-50"
          >
            Comprar NFT
          </button>
          <button
            type="button"
            disabled={soldOut || add.isPending}
            onClick={() => addToCart(false)}
            aria-label="Adicionar ao carrinho"
            className="grid size-12 place-items-center rounded-full bg-surface-2 text-accent disabled:opacity-50"
          >
            <ShoppingCart className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      <Dialog open={isZoomOpen} onOpenChange={setIsZoomOpen}>
        <DialogContent className="max-w-[min(92vw,720px)] border-line bg-surface p-3 sm:max-w-[720px]">
          <DialogTitle className="sr-only">{nft.name}</DialogTitle>
          <DialogDescription className="sr-only">Imagem ampliada do NFT</DialogDescription>
          <img src={nft.gallery[imageIndex]} alt={`Arte ampliada do NFT ${nft.name}`} className="w-full rounded-lg" />
        </DialogContent>
      </Dialog>
    </div>
  )
}
