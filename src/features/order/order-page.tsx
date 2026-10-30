import type { ReactNode } from 'react'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { ExternalLink, Loader2, X, XCircle } from 'lucide-react'
import { useOrder } from '@/api/queries'
import { isApiError } from '@/api/http'
import { ErrorState } from '@/components/feedback'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/eth'

const route = getRouteApi('/pedido/$orderId')

const NETWORK_LABEL = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' } as const
const PROVIDER_LABEL = { metamask: 'MetaMask', walletconnect: 'WalletConnect', coinbase: 'Coinbase Wallet' } as const

function ThankYouIcon() {
  return (
    <svg viewBox="0 0 72 72" className="size-16 text-accent" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M8 30 36 52 64 30v34H8z" strokeLinejoin="round" />
      <path d="m8 64 22-18M64 64 42 46" />
      <path d="M8 30 36 8l28 22" strokeLinejoin="round" />
      <rect x="16" y="14" width="40" height="26" rx="2" fill="var(--color-surface)" />
      <text x="36" y="25" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" stroke="none">
        THANK
      </text>
      <text x="36" y="35" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" stroke="none">
        YOU
      </text>
    </svg>
  )
}

function shortHash(hash: string) {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`
}

export function OrderPage() {
  const { orderId } = route.useParams()
  const navigate = useNavigate()
  const { data: order, isPending, isError, error, refetch, isFetching } = useOrder(orderId)

  // caixa branca em volta de todos os estados da página
  const shell = (children: ReactNode) => (
    <div className="container-k flex justify-center py-8 md:py-16">
      <div className="relative w-full max-w-xl overflow-hidden bg-surface shadow-2xl">{children}</div>
    </div>
  )

  if (isPending) {
    return shell(
      <div className="space-y-4 p-8" aria-busy="true">
        <span className="sr-only" role="status">
          Carregando pedido…
        </span>
        <Skeleton className="mx-auto size-16" />
        <Skeleton className="mx-auto h-5 w-2/3" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>,
    )
  }
  if (isError) {
    if (isApiError(error) && (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN')) {
      return shell(
        <div className="p-8 text-center">
          <h1 className="text-lg font-bold">{error.code === 'FORBIDDEN' ? 'Acesso negado' : 'Pedido não encontrado'}</h1>
          <p className="mt-2 text-sm text-muted">{error.message}</p>
          <Link to="/" className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-bold text-accent-ink">
            Voltar ao início
          </Link>
        </div>,
      )
    }
    return (
      <div className="container-k py-10">
        <ErrorState error={error} onRetry={() => refetch()} retrying={isFetching} />
      </div>
    )
  }

  // o recibo só aparece quando o pagamento foi confirmado de verdade
  if (order.status === 'pending') {
    return shell(
      <div className="flex flex-col items-center gap-3 p-10 text-center" role="status" aria-live="polite">
        <Loader2 className="size-10 animate-spin text-accent" aria-hidden />
        <h1 className="text-lg font-bold">Pagamento pendente</h1>
        <p className="text-sm text-muted">Aguardando a confirmação da transação na rede. Esta página será atualizada automaticamente.</p>
        <p className="text-xs text-muted">Pedido {order.id}</p>
      </div>,
    )
  }
  if (order.status === 'rejected') {
    return shell(
      <div className="flex flex-col items-center gap-3 p-10 text-center">
        <XCircle className="size-10 text-danger" aria-hidden />
        <h1 className="text-lg font-bold">Pagamento recusado</h1>
        <p className="text-sm text-muted">{order.failureReason ?? 'A transação foi recusada.'} Seus itens continuam no carrinho.</p>
        <Link to="/carrinho" className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-accent-ink">
          Voltar ao carrinho
        </Link>
      </div>,
    )
  }

  const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(order.createdAt))

  return shell(
    <>
      <button type="button" onClick={() => navigate({ to: '/' })} className="absolute top-4 right-4 rounded p-1 text-accent hover:bg-surface-2" aria-label="Fechar recibo e voltar ao início">
        <X className="size-5" aria-hidden />
      </button>
      <div className="flex flex-col items-center gap-3 px-6 pt-6 pb-5">
        <ThankYouIcon />
        <h1 className="text-center text-sm font-bold text-muted">Seus NFTs agora estão na sua carteira</h1>
      </div>
      <dl className="grid grid-cols-2 gap-y-3 border-y border-accent px-6 py-4 text-xs sm:grid-cols-4 sm:divide-x sm:divide-accent/50">
        <div className="sm:pr-3">
          <dt className="font-bold">ID da transação</dt>
          <dd className="mt-1 text-sm" title={order.transactionHash ?? ''} data-testid="tx-id">
            {order.transactionHash ? shortHash(order.transactionHash) : '—'}
          </dd>
        </div>
        <div className="sm:px-3">
          <dt className="text-muted">Data</dt>
          <dd className="mt-1 text-sm">{date}</dd>
        </div>
        <div className="sm:px-3">
          <dt className="text-muted">Total</dt>
          <dd className="mt-1 text-sm tabular-nums">{formatEth(order.total)}</dd>
        </div>
        <div className="sm:pl-3">
          <dt className="font-bold">Carteira</dt>
          <dd className="mt-1 text-sm">{PROVIDER_LABEL[order.wallet.provider]}</dd>
        </div>
      </dl>
      <div className="px-6 py-6 sm:px-10">
        <h2 className="text-sm font-bold">Detalhes da transação</h2>
        <table className="mt-3 w-full text-sm" data-testid="receipt-items">
          <caption className="sr-only">Itens comprados</caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="pb-2 font-bold">
                NFTs
              </th>
              <th scope="col" className="pb-2 text-center font-bold">
                Edições
              </th>
              <th scope="col" className="pb-2 text-right font-bold">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={`${item.nftId}/${item.editionId}`}>
                <td className="py-2">
                  <div className="flex items-center gap-3">
                    <img src={item.image} alt="" width={64} height={64} className="size-14 rounded object-cover sm:size-16" />
                    <div>
                      <p className="font-bold">{item.name}</p>
                      <p className="text-xs text-muted">
                        ID do token: {item.tokenId} · {item.editionLabel}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="text-center text-xs text-muted">(x {item.quantity})</td>
                <td className="text-right font-bold text-accent tabular-nums">{formatEth(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-3 space-y-1 border-b border-line pb-3 text-sm">
          {order.coupon && (
            <div className="flex justify-between">
              <dt>Desconto ({order.coupon.code})</dt>
              <dd className="tabular-nums">(-) {formatEth(order.discount, { suffix: false })}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Taxa de rede</dt>
            <dd className="tabular-nums">{formatEth(order.networkFee)}</dd>
          </div>
          <div className="flex justify-between font-bold">
            <dt>Total</dt>
            <dd className="text-accent tabular-nums" data-testid="receipt-total">
              {formatEth(order.total)}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-center text-xs leading-relaxed text-muted">
          Transação confirmada na {NETWORK_LABEL[order.wallet.network]} (simulação). A propriedade foi transferida para sua carteira conectada e registrada na rede.
        </p>
        {order.explorerUrl && (
          <div className="mt-5 flex justify-center">
            <a href={order.explorerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-bold text-accent-ink hover:bg-accent-strong">
              Ver no Etherscan <ExternalLink className="size-3.5" aria-hidden />
              <span className="sr-only">(link simulado, abre em nova aba)</span>
            </a>
          </div>
        )}
      </div>
      <div className="h-2 bg-accent" />
    </>,
  )
}
