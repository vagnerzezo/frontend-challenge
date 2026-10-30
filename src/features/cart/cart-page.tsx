import { useState } from 'react'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { AlertTriangle, ChevronLeft, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { CartLine } from '@/api/contracts'
import {
  useAcknowledgeCart,
  useApplyCoupon,
  useCart,
  useCartQuote,
  useCatalog,
  useRemoveCartItem,
  useRemoveCoupon,
  useSetCartQuantity,
} from '@/api/queries'
import { isApiError } from '@/api/http'
import { Breadcrumb, EmptyState, ErrorState, errorMessage } from '@/components/feedback'
import { QuantityStepper } from '@/components/nft/quantity-stepper'
import { NftCard } from '@/components/nft/nft-card'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollRow } from '@/features/nft/nft-detail-page'
import { formatEth } from '@/lib/eth'
import { OrderSummary } from './order-summary'

function LineNotice({ line }: { line: CartLine }) {
  if (line.available === 0) return <p className="text-xs text-danger">Edição esgotada — remova o item para continuar.</p>
  if (line.quantity > line.available) return <p className="text-xs text-danger">Apenas {line.available} disponível(is). Ajuste a quantidade.</p>
  if (line.priceWhenAdded !== line.unitPrice) {
    return (
      <p className="text-xs text-accent-strong">
        <AlertTriangle className="mr-1 inline size-3" aria-hidden />
        Preço alterado: de {formatEth(line.priceWhenAdded)} para {formatEth(line.unitPrice)}
      </p>
    )
  }
  return null
}

// ações usadas tanto na linha da tabela (desktop) quanto no card (mobile)
function useLineActions(line: CartLine) {
  const setQuantity = useSetCartQuantity()
  const removeItem = useRemoveCartItem()
  const busy = setQuantity.isPending || removeItem.isPending

  function changeQuantity(quantity: number) {
    setQuantity.mutate(
      { nftId: line.nftId, editionId: line.editionId, quantity },
      { onError: (error) => toast.error(errorMessage(error, 'Não foi possível alterar a quantidade.')) },
    )
  }

  function remove() {
    removeItem.mutate(
      { nftId: line.nftId, editionId: line.editionId, name: line.name },
      {
        onSuccess: () => toast.success(`${line.name} removido do carrinho.`),
        onError: (error) => toast.error(errorMessage(error, 'Não foi possível remover o item.')),
      },
    )
  }

  return { busy, changeQuantity, remove }
}

function DesktopRow({ line }: { line: CartLine }) {
  const { busy, changeQuantity, remove } = useLineActions(line)
  return (
    <tr className="bg-surface" data-testid="cart-line">
      <td className="rounded-l-md py-2 pl-2">
        <div className="flex items-center gap-3">
          <img src={line.image} alt="" width={50} height={50} className="size-12 rounded object-cover" />
          <div className="min-w-0">
            <Link to="/nft/$nftId" params={{ nftId: line.nftId }} className="block truncate text-sm font-bold hover:text-accent">
              {line.name}
            </Link>
            <p className="text-xs text-muted">
              ID do token: {line.tokenId} · Edição {line.editionLabel}
            </p>
            <LineNotice line={line} />
          </div>
        </div>
      </td>
      <td className="text-sm tabular-nums">{formatEth(line.unitPrice)}</td>
      <td>
        <QuantityStepper value={line.quantity} max={Math.max(line.available, 1)} onChange={changeQuantity} label={`Edições de ${line.name}`} disabled={busy} size="sm" />
      </td>
      <td className="text-sm font-bold text-accent tabular-nums">{formatEth(line.lineTotal)}</td>
      <td className="rounded-r-md pr-3 text-right">
        <button type="button" onClick={remove} disabled={busy} aria-label={`Remover ${line.name} (${line.editionLabel}) do carrinho`} className="rounded p-1 text-muted hover:text-danger">
          <Trash2 className="size-4" aria-hidden />
        </button>
      </td>
    </tr>
  )
}

function MobileItem({ line }: { line: CartLine }) {
  const { busy, changeQuantity, remove } = useLineActions(line)
  return (
    <li className="flex overflow-hidden rounded-xl bg-surface" data-testid="cart-line-mobile">
      <img src={line.image} alt="" width={106} height={106} className="w-[106px] shrink-0 object-cover" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <Link to="/nft/$nftId" params={{ nftId: line.nftId }} className="truncate text-sm font-bold">
            {line.name}
          </Link>
          <button type="button" onClick={remove} disabled={busy} aria-label={`Remover ${line.name} (${line.editionLabel}) do carrinho`} className="text-muted">
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
        <p className="text-xs text-muted">Edição: {line.editionLabel}</p>
        <LineNotice line={line} />
        <div className="mt-auto flex items-center justify-between">
          <p className="font-bold text-accent">{formatEth(line.lineTotal)}</p>
          <QuantityStepper value={line.quantity} max={Math.max(line.available, 1)} onChange={changeQuantity} label={`Edições de ${line.name}`} disabled={busy} size="sm" />
        </div>
      </div>
    </li>
  )
}

export function CouponForm({ applied }: { applied: string | null }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()
  if (applied) {
    return (
      <div className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-xs">
        <span>
          Cupom aplicado: <strong className="text-accent">{applied}</strong>
        </span>
        <button
          type="button"
          className="text-accent underline-offset-2 hover:underline"
          disabled={remove.isPending}
          onClick={() => remove.mutate(undefined, { onError: (error) => toast.error(errorMessage(error)) })}
        >
          Remover
        </button>
      </div>
    )
  }
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (!code.trim()) {
          setError('Informe um código promocional.')
          return
        }
        apply.mutate(code.trim(), {
          onSuccess: () => {
            setError(null)
            setCode('')
          },
          onError: (error) => setError(isApiError(error) ? (error.fields?.couponCode ?? error.message) : 'Não foi possível aplicar o cupom.'),
        })
      }}
    >
      <label htmlFor="coupon" className="mb-2 block text-xs font-bold">
        Código promocional
      </label>
      <div className="flex">
        <input
          id="coupon"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Digite o código promocional..."
          aria-invalid={!!error}
          aria-describedby={error ? 'coupon-error' : undefined}
          className="h-9 min-w-0 flex-1 rounded-l-md border border-line bg-ink px-3 text-xs placeholder:text-subtle aria-invalid:border-danger"
        />
        <button type="submit" disabled={apply.isPending} className="rounded-r-md bg-accent px-4 text-xs font-bold text-accent-ink hover:bg-accent-strong disabled:opacity-60">
          {apply.isPending ? 'Aplicando…' : 'Aplicar'}
        </button>
      </div>
      {error && (
        <p id="coupon-error" role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </form>
  )
}

function AlsoViewed() {
  const { data, isPending } = useCatalog({ tab: 'em-alta', page: 1, pageSize: 8, sort: 'preco-desc' })
  return (
    <section aria-labelledby="also-title" className="mt-16 hidden md:block">
      <h2 id="also-title" className="text-sm font-bold text-accent">
        Colecionadores também viram
      </h2>
      <ScrollRow loading={isPending}>
        {data?.items.map((nft) => <NftCard key={nft.id} nft={nft} className="w-[200px] shrink-0 snap-start" />)}
      </ScrollRow>
    </section>
  )
}

export function CartPage() {
  const { data: cart, isPending, isError, error, refetch, isFetching } = useCart()
  const quote = useCartQuote(cart)
  const acknowledge = useAcknowledgeCart()
  const navigate = useNavigate()
  const router = useRouter()

  const items = cart?.items ?? []
  const changedItems = items.filter((item) => item.priceWhenAdded !== item.unitPrice)
  const hasUnavailableItem = items.some((item) => item.quantity > item.available || item.available === 0)
  const canCheckout = items.length > 0 && !hasUnavailableItem && !!quote.data && !quote.isError && !quote.isPlaceholderData

  const header = (
    <div className="flex items-center gap-4 px-4 pt-4 md:hidden">
      <button type="button" onClick={() => router.history.back()} className="grid size-10 place-items-center rounded-full bg-surface" aria-label="Voltar">
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      <h1 className="flex-1 pr-14 text-center text-lg font-bold">Carrinho de NFTs</h1>
    </div>
  )

  return (
    <div>
      {header}
      <div className="container-k">
        <div className="hidden md:block">
          <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/' }, { label: 'Carrinho' }]} />
          <h1 className="sr-only">Carrinho de NFTs</h1>
        </div>

        {isPending ? (
          <div className="mt-4 grid gap-10 md:grid-cols-[1fr_280px] lg:grid-cols-[1fr_300px]" aria-busy="true" data-testid="cart-skeleton">
            <span className="sr-only" role="status">
              Carregando carrinho…
            </span>
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
            <Skeleton className="h-72 w-full" />
          </div>
        ) : isError ? (
          <ErrorState title="Não foi possível carregar o carrinho" error={error} onRetry={() => refetch()} retrying={isFetching} className="mt-6" />
        ) : items.length === 0 ? (
          <EmptyState title="Seu carrinho está vazio" className="mt-6">
            <p className="text-sm text-muted">Explore o mercado e adicione NFTs ao carrinho.</p>
            <Link to="/" hash="catalogo" className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-accent-ink">
              Explorar o mercado
            </Link>
          </EmptyState>
        ) : (
          <div className="mt-4 grid gap-8 md:grid-cols-[1fr_280px] lg:grid-cols-[1fr_300px] lg:gap-14">
            <div className="min-w-0">
              {changedItems.length > 0 && (
                <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-accent/60 bg-band px-3 py-2 text-xs" data-testid="price-change-notice">
                  <span>
                    <AlertTriangle className="mr-1 inline size-3.5 text-accent" aria-hidden />
                    {changedItems.length === 1 ? 'O preço de 1 item mudou' : `Os preços de ${changedItems.length} itens mudaram`} desde que foram adicionados. O resumo foi atualizado.
                  </span>
                  <button type="button" className="font-bold text-accent underline-offset-2 hover:underline" onClick={() => acknowledge.mutate()} disabled={acknowledge.isPending}>
                    Entendi
                  </button>
                </div>
              )}
              <table className="hidden w-full border-separate border-spacing-y-2 md:table">
                <caption className="sr-only">Itens no carrinho</caption>
                <thead>
                  <tr className="text-left text-sm">
                    <th scope="col" className="border-b border-line pb-2 font-bold">
                      NFTs
                    </th>
                    <th scope="col" className="border-b border-line pb-2 font-bold">
                      Preço
                    </th>
                    <th scope="col" className="border-b border-line pb-2 font-bold">
                      Edições
                    </th>
                    <th scope="col" className="border-b border-line pb-2 font-bold">
                      Total
                    </th>
                    <th scope="col" className="border-b border-line pb-2">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <DesktopRow key={`${item.nftId}/${item.editionId}`} line={item} />
                  ))}
                </tbody>
              </table>
              <ul className="space-y-3 md:hidden">
                {items.map((item) => (
                  <MobileItem key={`${item.nftId}/${item.editionId}`} line={item} />
                ))}
              </ul>
            </div>

            <aside aria-labelledby="summary-title" className="rounded-3xl bg-surface p-5 md:rounded-none md:bg-transparent md:p-0">
              <h2 id="summary-title" className="hidden border-b border-line pb-2 text-sm font-bold md:block">
                Resumo da carteira
              </h2>
              <div className="md:mt-5">
                <CouponForm applied={cart!.couponCode} />
              </div>
              <OrderSummary quote={quote} className="mt-5" />
              {hasUnavailableItem && (
                <p role="alert" className="mt-3 text-xs text-danger">
                  Ajuste os itens indisponíveis para continuar.
                </p>
              )}
              <button
                type="button"
                disabled={!canCheckout}
                onClick={() => navigate({ to: '/pagamento' })}
                className="mt-5 h-12 w-full rounded-full bg-gradient-to-r from-accent to-[#a8693e] text-sm font-bold text-accent-ink disabled:cursor-not-allowed disabled:opacity-50 md:h-10 md:rounded-md md:bg-none md:bg-accent"
              >
                Conectar e finalizar
              </button>
              <Link to="/" hash="catalogo" className="mt-3 block text-center text-xs text-accent hover:underline">
                Continuar explorando
              </Link>
            </aside>
          </div>
        )}
        <AlsoViewed />
      </div>
    </div>
  )
}
