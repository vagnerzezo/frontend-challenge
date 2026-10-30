import { Link } from '@tanstack/react-router'
import { AlertTriangle, Loader2, XCircle } from 'lucide-react'
import type { Order, Quote } from '@/api/contracts'
import type { ApiError } from '@/api/http'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/eth'
import type { CheckoutStep } from './use-checkout'

interface Props {
  step: CheckoutStep
  quote: Quote | null
  previous: Quote | null
  error: ApiError | null
  statusMessage: string | null
  order: Order | undefined
  walletLabel: string
  onConfirm: () => void
  onRetry: () => void
  onClose: () => void
}

function QuoteTable({ quote, previous }: { quote: Quote; previous: Quote | null }) {
  return (
    <div className="text-xs">
      <ul className="space-y-2">
        {quote.items.map((item) => {
          const previousItem = previous?.items.find((old) => old.nftId === item.nftId && old.editionId === item.editionId)
          const priceChanged = previousItem && previousItem.unitPrice !== item.unitPrice
          return (
            <li key={`${item.nftId}/${item.editionId}`} className="flex items-center gap-3">
              <img src={item.image} alt="" width={36} height={36} className="size-9 rounded object-cover" />
              <span className="min-w-0 flex-1 truncate">
                {item.name} <span className="text-muted">({item.editionLabel}) × {item.quantity}</span>
                {priceChanged && (
                  <span className="block text-accent-strong">
                    Preço: <s>{formatEth(previousItem.unitPrice)}</s> → {formatEth(item.unitPrice)}
                  </span>
                )}
              </span>
              <span className="font-bold text-accent tabular-nums">{formatEth(item.lineTotal)}</span>
            </li>
          )
        })}
      </ul>
      <dl className="mt-4 space-y-1.5 border-t border-line pt-3">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd className="tabular-nums">{formatEth(quote.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Desconto{quote.coupon ? ` (${quote.coupon.code})` : ''}</dt>
          <dd className="tabular-nums">(-) {formatEth(quote.discount, { suffix: false })}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Taxa de rede</dt>
          <dd className="tabular-nums">{formatEth(quote.networkFee)}</dd>
        </div>
        <div className="flex justify-between text-sm font-bold">
          <dt>Total</dt>
          <dd className="text-accent tabular-nums" data-testid="review-total">
            {previous && previous.total !== quote.total && <s className="mr-2 font-normal text-subtle">{formatEth(previous.total)}</s>}
            {formatEth(quote.total)}
          </dd>
        </div>
      </dl>
    </div>
  )
}

export function ReviewDialog({ step, quote, previous, error, statusMessage, order, walletLabel, onConfirm, onRetry, onClose }: Props) {
  const open = step !== 'idle' && step !== 'confirmed'
  // enquanto o pagamento está em andamento o usuário não pode fechar o modal
  const busy = step === 'connecting' || step === 'submitting' || step === 'pending'
  const changed = !!previous && !!quote && previous.fingerprint !== quote.fingerprint

  let busyTitle = 'Pagamento pendente'
  if (step === 'connecting') busyTitle = 'Conectando carteira'
  if (step === 'submitting') busyTitle = 'Enviando pedido'

  let busyMessage = statusMessage ?? 'Aguarde…'
  if (!statusMessage && step === 'pending') {
    busyMessage = 'Aguardando a confirmação da transação na rede. Você pode recarregar a página: o pedido não será duplicado.'
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto border-line bg-surface sm:max-w-md"
        showCloseButton={!busy}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (busy) event.preventDefault()
        }}
        data-testid="checkout-dialog"
      >
        {step === 'reviewing' && (
          <>
            <DialogTitle>Revise seu pedido</DialogTitle>
            <DialogDescription className="text-muted">Valores revalidados agora com a API. Pagamento via {walletLabel}.</DialogDescription>
            {changed && (
              <p role="alert" className="flex gap-2 rounded-md border border-accent/60 bg-band p-2 text-xs" data-testid="quote-changed">
                <AlertTriangle className="size-4 shrink-0 text-accent" aria-hidden />
                Os valores mudaram desde a última visualização. Confira e confirme novamente.
              </p>
            )}
            {statusMessage && (
              <p role="status" className="text-xs text-muted">
                {statusMessage}
              </p>
            )}
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error.message}
              </p>
            ) : quote ? (
              <QuoteTable quote={quote} previous={previous} />
            ) : (
              <div className="space-y-2" aria-busy="true">
                <span className="sr-only" role="status">
                  Revalidando cotação…
                </span>
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            )}
            <div className="mt-2 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                onClick={onConfirm}
                disabled={!quote || !!error}
                className="h-10 flex-1 rounded-md bg-accent text-sm font-bold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
              >
                {changed ? 'Confirmar novos valores e pagar' : 'Confirmar e pagar'}
              </button>
              <button type="button" onClick={onClose} className="h-10 flex-1 rounded-md border border-line text-sm">
                Voltar
              </button>
            </div>
          </>
        )}

        {busy && (
          <div className="flex flex-col items-center gap-3 py-4 text-center" role="status" aria-live="polite">
            <Loader2 className="size-10 animate-spin text-accent" aria-hidden />
            <DialogTitle>{busyTitle}</DialogTitle>
            <DialogDescription className="text-sm text-muted">{busyMessage}</DialogDescription>
            {order && (
              <p className="text-xs text-muted" data-testid="pending-order-id">
                Pedido {order.id} · {formatEth(order.total)}
              </p>
            )}
          </div>
        )}

        {step === 'rejected' && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <XCircle className="size-10 text-danger" aria-hidden />
            <DialogTitle>Pagamento recusado</DialogTitle>
            <DialogDescription className="text-sm text-muted">
              {order?.failureReason ?? 'A transação foi recusada.'} Seus itens continuam no carrinho.
            </DialogDescription>
            <div className="flex w-full gap-2">
              <button type="button" onClick={onRetry} className="h-10 flex-1 rounded-md bg-accent text-sm font-bold text-accent-ink">
                Tentar novamente
              </button>
              <Link to="/carrinho" className="grid h-10 flex-1 place-items-center rounded-md border border-line text-sm">
                Ver carrinho
              </Link>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <AlertTriangle className="size-10 text-danger" aria-hidden />
            <DialogTitle>Não foi possível concluir</DialogTitle>
            <DialogDescription className="text-sm text-muted" role="alert">
              {error?.message ?? 'Erro inesperado.'}
            </DialogDescription>
            <div className="flex w-full gap-2">
              <button type="button" onClick={onRetry} className="h-10 flex-1 rounded-md bg-accent text-sm font-bold text-accent-ink">
                Revisar novamente
              </button>
              <button type="button" onClick={onClose} className="h-10 flex-1 rounded-md border border-line text-sm">
                Fechar
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
