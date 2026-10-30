import { useEffect, useRef } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import type { Network, Wallet, WalletProvider } from '@/api/contracts'
import { checkoutSchema, type CheckoutForm } from '@/api/schemas'
import { useCart, useCartQuote, useProfile, useWallets } from '@/api/queries'
import { Breadcrumb, EmptyState, ErrorState } from '@/components/feedback'
import { Field, NativeSelect, TextInput, inputClass } from '@/components/form'
import { Skeleton } from '@/components/ui/skeleton'
import { CouponForm } from '@/features/cart/cart-page'
import { OrderSummary } from '@/features/cart/order-summary'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { useSession } from '@/session/use-session'
import { ReviewDialog } from './review-dialog'
import { useCheckout } from './use-checkout'

export const PROVIDERS: Array<{ value: WalletProvider; label: string; letter: string }> = [
  { value: 'walletconnect', label: 'WalletConnect', letter: 'W' },
  { value: 'metamask', label: 'MetaMask', letter: 'M' },
  { value: 'coinbase', label: 'Coinbase Wallet', letter: 'C' },
]
export const NETWORK_OPTIONS: Array<{ value: Network; label: string }> = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'solana', label: 'Solana' },
]

// ex.: 0x1234…abcd
function shortAddress(address: string) {
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function getDraftKey(userId: string) {
  return `kurio.checkout.draft.${userId}`
}

const EMPTY_FORM: CheckoutForm = {
  displayName: '',
  username: '',
  profileName: '',
  network: undefined as unknown as Network,
  address: '',
  secondaryAddress: '',
  provider: undefined as unknown as WalletProvider,
  referralCode: '',
  email: '',
  ensName: '',
  useOtherWallet: false,
  walletId: undefined,
  note: '',
}

function walletToForm(wallet: Wallet): Partial<CheckoutForm> {
  return {
    walletId: wallet.id,
    network: wallet.network,
    address: wallet.address,
    provider: wallet.provider,
    secondaryAddress: wallet.secondaryAddress ?? '',
    referralCode: wallet.referralCode,
    profileName: wallet.profileName,
  }
}

export function CheckoutPage() {
  const { user } = useSession()
  const navigate = useNavigate()
  const router = useRouter()
  const { data: cart, isPending: cartPending, isError: cartError, error, refetch } = useCart()
  const quote = useCartQuote(cart)
  const { data: wallets, isPending: walletsPending } = useWallets()
  const { data: profile } = useProfile()
  const checkout = useCheckout(quote.data)
  const alreadyFilled = useRef(false)

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: EMPTY_FORM,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })
  const { register, handleSubmit, setValue, reset, control, formState } = form
  const errors = formState.errors
  const values = useWatch({ control })

  // preenche o formulário uma vez: primeiro com perfil + carteira principal,
  // e por cima o rascunho salvo (caso a sessão tenha expirado no meio do checkout)
  useEffect(() => {
    if (alreadyFilled.current || !user || !profile || walletsPending) return
    alreadyFilled.current = true

    let draft: Partial<CheckoutForm> | null = null
    try {
      const saved = sessionStorage.getItem(getDraftKey(user.id))
      if (saved) draft = JSON.parse(saved)
    } catch {
      draft = null
    }

    const primary = wallets?.find((wallet) => wallet.slot === 'primary')
    const walletValues = primary ? walletToForm(primary) : { useOtherWallet: true }

    reset({
      ...EMPTY_FORM,
      displayName: profile.displayName,
      username: profile.username,
      email: profile.email,
      ensName: profile.ensName,
      profileName: profile.username,
      ...walletValues,
      ...draft,
    })
  }, [user, profile, wallets, walletsPending, reset])

  // salva um rascunho do formulário a cada mudança
  useEffect(() => {
    if (!user || !alreadyFilled.current) return
    try {
      sessionStorage.setItem(getDraftKey(user.id), JSON.stringify(values))
    } catch {
      // sessionStorage indisponível
    }
  }, [values, user])

  // pagamento confirmado: limpa o rascunho e vai para a página do pedido
  useEffect(() => {
    if (checkout.step === 'confirmed' && checkout.order?.status === 'confirmed') {
      try {
        sessionStorage.removeItem(getDraftKey(user!.id))
      } catch {
        // sessionStorage indisponível
      }
      checkout.reset()
      navigate({ to: '/pedido/$orderId', params: { orderId: checkout.order.id }, replace: true })
    }
  }, [checkout, navigate, user])

  // null = "usar outra carteira"
  const selectWallet = (wallet: Wallet | null) => {
    if (!wallet) {
      setValue('useOtherWallet', true, { shouldDirty: true })
      setValue('walletId', undefined)
      return
    }

    const options = { shouldValidate: formState.isSubmitted }
    setValue('useOtherWallet', false, { shouldDirty: true })
    setValue('walletId', wallet.id, options)
    setValue('network', wallet.network, options)
    setValue('address', wallet.address, options)
    setValue('provider', wallet.provider, options)
    setValue('secondaryAddress', wallet.secondaryAddress ?? '', options)
    setValue('referralCode', wallet.referralCode, options)
    setValue('profileName', wallet.profileName, options)
  }

  // desmarcar "usar outra carteira" volta para a carteira principal
  const handleOtherWalletChange = (checked: boolean) => {
    const primary = wallets?.find((wallet) => wallet.slot === 'primary') ?? null
    selectWallet(checked ? null : primary)
  }

  const usingRegistered = !values.useOtherWallet && !!values.walletId
  const selectedWallet = wallets?.find((wallet) => wallet.id === values.walletId)
  const providerLabel = PROVIDERS.find((provider) => provider.value === values.provider)?.label ?? 'carteira'

  const items = cart?.items ?? []
  const hasUnavailableItem = items.some((item) => item.quantity > item.available || item.available === 0)
  const canSubmit = items.length > 0 && !hasUnavailableItem && !!quote.data

  const onConfirm = () => {
    const data = form.getValues()
    const buyer = {
      displayName: data.displayName,
      username: data.username,
      profileName: data.profileName,
      email: data.email,
      referralCode: data.referralCode,
      ensName: data.ensName,
      note: data.note || undefined,
    }
    const payment = {
      walletId: usingRegistered ? data.walletId : undefined,
      provider: data.provider,
      network: data.network,
      address: data.address,
    }
    checkout.submit(buyer, payment)
  }

  const walletSection = (
    <section aria-labelledby="wallet-title" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="wallet-title" className="text-sm font-bold md:text-center md:w-full">
          Carteira e rede
        </h2>
        <Link to="/perfil/carteiras" className="shrink-0 text-xs text-accent hover:underline md:hidden">
          Trocar carteira
        </Link>
      </div>
      <fieldset>
        <legend className="mb-2 text-xs text-muted">Carteira conectada</legend>
        {walletsPending ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="space-y-2" role="radiogroup" aria-label="Carteira cadastrada">
            {wallets?.map((wallet) => {
              const isSelected = values.walletId === wallet.id && !values.useOtherWallet
              const networkLabel = NETWORK_OPTIONS.find((option) => option.value === wallet.network)?.label
              return (
                <label key={wallet.id} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border bg-surface px-4 py-3', isSelected ? 'border-accent' : 'border-line')}>
                  <input type="radio" name="registered-wallet" className="size-4 accent-[var(--color-accent)]" checked={isSelected} onChange={() => selectWallet(wallet)} />
                  <span className="min-w-0 text-sm">
                    <span className="block font-bold">{wallet.nickname}</span>
                    <span className="block truncate text-xs text-muted">
                      {wallet.secondaryAddress || shortAddress(wallet.address)} · Rede {networkLabel}
                    </span>
                  </span>
                </label>
              )
            })}
            <label className={cn('flex cursor-pointer items-center gap-3 rounded-xl border bg-surface px-4 py-3 text-sm', values.useOtherWallet ? 'border-accent' : 'border-line')}>
              <input type="radio" name="registered-wallet" className="size-4 accent-[var(--color-accent)]" checked={!!values.useOtherWallet} onChange={() => selectWallet(null)} />
              Usar outra carteira
            </label>
            {errors.walletId && <p className="text-xs text-danger">{errors.walletId.message}</p>}
            {!wallets?.length && (
              <p className="text-xs text-muted">
                Nenhuma carteira cadastrada.{' '}
                <Link to="/perfil/carteiras" className="text-accent underline">
                  Cadastrar carteira
                </Link>
              </p>
            )}
          </div>
        )}
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-xs text-muted">Conectar com</legend>
        <div className="space-y-2" role="radiogroup" aria-label="Provedor da carteira" aria-invalid={!!errors.provider} aria-describedby={errors.provider ? 'provider-error' : undefined}>
          {PROVIDERS.map((provider) => (
            <label key={provider.value} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border bg-surface px-4 py-3 text-sm', values.provider === provider.value ? 'border-accent' : 'border-line')}>
              <span aria-hidden className="grid size-9 place-items-center rounded-full bg-surface-2 text-xs font-bold text-accent">
                {provider.letter}
              </span>
              <span className="flex-1">{provider.label}</span>
              <input type="radio" value={provider.value} className="size-4 accent-[var(--color-accent)]" {...register('provider')} />
            </label>
          ))}
        </div>
        {errors.provider && (
          <p id="provider-error" className="mt-1 text-xs text-danger">
            {errors.provider.message}
          </p>
        )}
      </fieldset>
    </section>
  )

  if (cartPending) {
    return (
      <div className="container-k py-8" aria-busy="true">
        <span className="sr-only" role="status">
          Carregando pagamento…
        </span>
        <div className="grid gap-8 md:grid-cols-[1fr_340px]">
          <Skeleton className="h-[480px] w-full" />
          <Skeleton className="h-[480px] w-full" />
        </div>
      </div>
    )
  }
  if (cartError) {
    return (
      <div className="container-k py-8">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    )
  }
  if (items.length === 0 && checkout.step === 'idle') {
    return (
      <div className="container-k py-8">
        <EmptyState title="Não há itens para pagamento">
          <Link to="/" hash="catalogo" className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-accent-ink">
            Explorar o mercado
          </Link>
        </EmptyState>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-4 px-4 pt-4 md:hidden">
        <button type="button" onClick={() => router.history.back()} className="grid size-10 place-items-center rounded-full bg-surface" aria-label="Voltar">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <h1 className="flex-1 pr-14 text-center text-lg font-bold">Pagamento com carteira</h1>
      </div>
      <div className="container-k">
        <div className="hidden md:block">
          <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/' }, { label: 'Pagamento' }]} />
          <h1 className="sr-only">Pagamento</h1>
        </div>
        <div className="mt-4 grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <form id="checkout-form" noValidate onSubmit={handleSubmit(() => checkout.startReview())} aria-labelledby="buyer-title" className="order-2 md:order-1">
            <h2 id="buyer-title" className="mb-4 text-sm font-bold">
              Perfil do colecionador
            </h2>
            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
              <Field label="Nome de exibição" required error={errors.displayName?.message}>
                {(fieldProps) => <TextInput {...fieldProps} autoComplete="name" {...register('displayName')} />}
              </Field>
              <Field label="Nome de usuário" required error={errors.username?.message}>
                {(fieldProps) => <TextInput {...fieldProps} autoComplete="username" {...register('username')} />}
              </Field>
              <Field label="Rede" required error={errors.network?.message}>
                {(fieldProps) => (
                  <NativeSelect {...fieldProps} {...register('network')}>
                    <option value="">Selecione uma rede</option>
                    {NETWORK_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
              <Field label="Nome do perfil" required error={errors.profileName?.message}>
                {(fieldProps) => <TextInput {...fieldProps} {...register('profileName')} />}
              </Field>
              <Field label="Endereço da carteira" required error={errors.address?.message}>
                {(fieldProps) => <TextInput {...fieldProps} placeholder="Endereço 0x da carteira" readOnly={usingRegistered} spellCheck={false} {...register('address')} />}
              </Field>
              <Field label={<span className="sm:invisible">ENS ou carteira secundária (opcional)</span>} error={errors.secondaryAddress?.message}>
                {(fieldProps) => <TextInput {...fieldProps} placeholder="ENS ou carteira secundária (opcional)" readOnly={usingRegistered} {...register('secondaryAddress')} />}
              </Field>
              <Field label="Tipo de carteira" required error={errors.provider?.message}>
                {(fieldProps) => (
                  <NativeSelect
                    {...fieldProps}
                    value={values.provider ?? ''}
                    onChange={(event) => setValue('provider', event.target.value as WalletProvider, { shouldValidate: formState.isSubmitted, shouldDirty: true })}
                  >
                    <option value="">Selecione uma carteira</option>
                    {PROVIDERS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
              <Field label="Código de indicação" required error={errors.referralCode?.message}>
                {(fieldProps) => <TextInput {...fieldProps} {...register('referralCode')} />}
              </Field>
              <Field label="E-mail" required error={errors.email?.message}>
                {(fieldProps) => <TextInput {...fieldProps} type="email" autoComplete="email" {...register('email')} />}
              </Field>
              <Field label="Nome ENS" required error={errors.ensName?.message}>
                {(fieldProps) => (
                  <div className="flex gap-2">
                    <span className="grid h-10 shrink-0 place-items-center rounded-md border border-line px-3 text-sm" aria-hidden>
                      .eth
                    </span>
                    <TextInput {...fieldProps} {...register('ensName')} />
                  </div>
                )}
              </Field>
            </div>
            <label className="mt-5 flex w-fit cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={!!values.useOtherWallet} onChange={(event) => handleOtherWalletChange(event.target.checked)} />
              Usar outra carteira?
            </label>
            <Field label="Observação do colecionador (opcional)" className="mt-5 max-w-md" error={errors.note?.message}>
              {(fieldProps) => <textarea {...fieldProps} rows={5} className={cn(inputClass, 'h-auto py-2')} {...register('note')} />}
            </Field>
          </form>

          <aside className="order-1 space-y-5 md:order-2" aria-label="Resumo e carteira">
            <section aria-labelledby="items-title" className="hidden md:block">
              <h2 id="items-title" className="text-sm font-bold">
                Seus NFTs
              </h2>
              <div className="mt-2 flex justify-between border-b border-line pb-2 text-xs font-bold">
                <span>NFTs</span>
                <span>Subtotal</span>
              </div>
              <ul className="mt-2 space-y-2">
                {items.map((item) => (
                  <li key={`${item.nftId}/${item.editionId}`} className="flex items-center gap-2 rounded-md bg-surface p-1.5">
                    <img src={item.image} alt="" width={56} height={56} className="size-14 rounded object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{item.name}</p>
                      <p className="text-[11px] text-muted">ID do token: {item.tokenId}</p>
                    </div>
                    <span className="text-xs text-muted">(x {item.quantity})</span>
                    <span className="text-sm font-bold text-accent tabular-nums">{formatEth(item.lineTotal)}</span>
                  </li>
                ))}
              </ul>
            </section>
            <details className="text-xs">
              <summary className="cursor-pointer text-center">Tem um código promocional? Aplique aqui</summary>
              <div className="mt-3">
                <CouponForm applied={cart?.couponCode ?? null} />
              </div>
            </details>
            <OrderSummary quote={quote} />
            {walletSection}
            {hasUnavailableItem && (
              <p role="alert" className="text-xs text-danger">
                Há itens indisponíveis no carrinho. <Link to="/carrinho" className="underline">Ajustar carrinho</Link>
              </p>
            )}
            {formState.submitCount > 0 && Object.keys(errors).length > 0 && (
              <p role="alert" className="text-xs text-danger">
                Revise os campos destacados antes de confirmar.
              </p>
            )}
            <button
              type="submit"
              form="checkout-form"
              disabled={!canSubmit || checkout.step !== 'idle'}
              className="h-12 w-full rounded-full bg-gradient-to-r from-accent to-[#a8693e] text-sm font-bold text-accent-ink disabled:cursor-not-allowed disabled:opacity-50 md:h-10 md:rounded-md md:bg-none md:bg-accent"
            >
              Confirmar compra
            </button>
          </aside>
        </div>
      </div>

      <ReviewDialog
        step={checkout.step}
        quote={checkout.reviewQuote}
        previous={checkout.previousQuote}
        error={checkout.error}
        statusMessage={checkout.statusMessage}
        order={checkout.order}
        walletLabel={selectedWallet && usingRegistered ? `${providerLabel} (${selectedWallet.nickname})` : providerLabel}
        onConfirm={onConfirm}
        onRetry={() => {
          checkout.reset()
          checkout.startReview()
        }}
        onClose={checkout.close}
      />
    </div>
  )
}
