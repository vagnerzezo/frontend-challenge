import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import type { Wallet, WalletSlot } from '@/api/contracts'
import { walletSchema, type WalletForm } from '@/api/schemas'
import { useSaveWallet, useWallets } from '@/api/queries'
import { isApiError } from '@/api/http'
import { applyServerErrors, Field, NativeSelect, TextInput } from '@/components/form'
import { ErrorState, errorMessage } from '@/components/feedback'
import { Skeleton } from '@/components/ui/skeleton'
import { NETWORK_OPTIONS, PROVIDERS } from '@/features/checkout/checkout-page'
import { announce } from '@/lib/announcer'
import { useSession } from '@/session/use-session'

const FIELDS = ['displayName', 'nickname', 'network', 'profileName', 'address', 'secondaryAddress', 'provider', 'referralCode', 'email', 'ensName'] as const

function walletToForm(wallet: Partial<Wallet>): Partial<WalletForm> {
  return {
    displayName: wallet.displayName ?? '',
    nickname: wallet.nickname ?? '',
    network: wallet.network,
    profileName: wallet.profileName ?? '',
    address: wallet.address ?? '',
    secondaryAddress: wallet.secondaryAddress ?? '',
    provider: wallet.provider,
    referralCode: wallet.referralCode ?? '',
    email: wallet.email ?? '',
    ensName: wallet.ensName ?? '',
  }
}

function WalletFormView({ slot, wallet, initial, onDone }: { slot: WalletSlot; wallet?: Wallet; initial?: Partial<WalletForm>; onDone?: () => void }) {
  const save = useSaveWallet()
  const { register, handleSubmit, setError, reset, formState } = useForm<WalletForm>({
    resolver: zodResolver(walletSchema),
    defaultValues: initial ?? (wallet ? walletToForm(wallet) : {}),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })

  useEffect(() => {
    if (wallet) reset(walletToForm(wallet))
  }, [wallet, reset])

  const errors = formState.errors
  // prefixo para os ids dos campos não repetirem entre os dois formulários
  const idPrefix = slot === 'primary' ? 'pw' : 'sw'

  const onSubmit = handleSubmit((values) => {
    save.mutate(
      { id: wallet?.id, slot, input: { ...values, secondaryAddress: values.secondaryAddress ?? '' } },
      {
        onSuccess: () => {
          const message = `Carteira ${slot === 'primary' ? 'principal' : 'secundária'} salva.`
          toast.success(message)
          announce(message)
          onDone?.()
        },
        onError: (error) => {
          if (isApiError(error) && applyServerErrors(error.fields, setError, FIELDS)) return
          toast.error(errorMessage(error, 'Não foi possível salvar a carteira.'))
        },
      },
    )
  })

  return (
    <form noValidate aria-label={slot === 'primary' ? 'Carteira principal' : 'Carteira secundária'} onSubmit={onSubmit} className="mt-5">
      <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
        <Field label="Nome de exibição" required error={errors.displayName?.message} htmlFor={`${idPrefix}-display`}>
          {(fieldProps) => <TextInput {...fieldProps} {...register('displayName')} />}
        </Field>
        <Field label="Apelido da carteira" required error={errors.nickname?.message} htmlFor={`${idPrefix}-nick`}>
          {(fieldProps) => <TextInput {...fieldProps} {...register('nickname')} />}
        </Field>
        <Field label="Rede" required error={errors.network?.message} htmlFor={`${idPrefix}-network`}>
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
        <Field label="Nome do perfil" required error={errors.profileName?.message} htmlFor={`${idPrefix}-profile`}>
          {(fieldProps) => <TextInput {...fieldProps} {...register('profileName')} />}
        </Field>
        <Field label="Endereço da carteira" required error={errors.address?.message} htmlFor={`${idPrefix}-address`}>
          {(fieldProps) => <TextInput {...fieldProps} placeholder="Endereço 0x da carteira" spellCheck={false} {...register('address')} />}
        </Field>
        <Field label={<span className="sm:invisible">ENS ou carteira secundária (opcional)</span>} error={errors.secondaryAddress?.message} htmlFor={`${idPrefix}-secondary`}>
          {(fieldProps) => <TextInput {...fieldProps} placeholder="ENS ou carteira secundária (opcional)" {...register('secondaryAddress')} />}
        </Field>
        <Field label="Tipo de carteira" required error={errors.provider?.message} htmlFor={`${idPrefix}-provider`}>
          {(fieldProps) => (
            <NativeSelect {...fieldProps} {...register('provider')}>
              <option value="">Selecione uma carteira</option>
              {PROVIDERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Código de indicação" required error={errors.referralCode?.message} htmlFor={`${idPrefix}-ref`}>
          {(fieldProps) => <TextInput {...fieldProps} {...register('referralCode')} />}
        </Field>
        <Field label="E-mail" required error={errors.email?.message} htmlFor={`${idPrefix}-email`}>
          {(fieldProps) => <TextInput {...fieldProps} type="email" {...register('email')} />}
        </Field>
        <Field label="Nome ENS" required error={errors.ensName?.message} htmlFor={`${idPrefix}-ens`}>
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
      <div className="mt-5 flex gap-3">
        <button type="submit" disabled={save.isPending} className="h-9 rounded-md bg-accent px-4 text-sm font-bold text-accent-ink hover:bg-accent-strong disabled:opacity-60">
          {save.isPending ? 'Salvando…' : 'Salvar carteira'}
        </button>
        {onDone && !wallet && (
          <button type="button" onClick={onDone} className="h-9 rounded-md border border-line px-4 text-sm">
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}

export function WalletsPage() {
  const { data: wallets, isPending, isError, error, refetch } = useWallets()
  const { user } = useSession()
  const [addingPrimary, setAddingPrimary] = useState(false)
  const [addingSecondary, setAddingSecondary] = useState(false)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)

  if (isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <span className="sr-only" role="status">
          Carregando carteiras…
        </span>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />

  const primary = wallets.find((wallet) => wallet.slot === 'primary')
  const secondary = wallets.find((wallet) => wallet.slot === 'secondary')

  return (
    <div className="max-w-3xl">
      <section aria-labelledby="primary-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 id="primary-title" className="text-sm font-bold">
              Carteira principal
            </h1>
            <p className="mt-1 text-xs text-muted">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
          </div>
          {!primary && !addingPrimary && (
            <button type="button" onClick={() => setAddingPrimary(true)} className="text-sm text-accent hover:underline">
              Adicionar
            </button>
          )}
        </div>
        {primary ? (
          <WalletFormView slot="primary" wallet={primary} />
        ) : addingPrimary ? (
          <WalletFormView slot="primary" initial={{ email: user?.email, displayName: user?.displayName }} onDone={() => setAddingPrimary(false)} />
        ) : (
          <p className="mt-4 text-xs text-muted">Você ainda não adicionou uma carteira principal.</p>
        )}
      </section>

      <section aria-labelledby="secondary-title" className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="secondary-title" className="text-sm font-bold">
            Carteira secundária
          </h2>
          {!secondary && !addingSecondary && (
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={sameAsPrimary} onChange={(event) => setSameAsPrimary(event.target.checked)} disabled={!primary} className="size-4 accent-[var(--color-accent)]" />
                Igual à carteira principal
              </label>
              <button type="button" disabled={!primary} onClick={() => setAddingSecondary(true)} className="text-sm text-accent hover:underline disabled:opacity-50" aria-describedby={!primary ? 'secondary-hint' : undefined}>
                Adicionar
              </button>
            </div>
          )}
        </div>
        {secondary ? (
          <WalletFormView slot="secondary" wallet={secondary} />
        ) : addingSecondary ? (
          <WalletFormView
            slot="secondary"
            initial={sameAsPrimary && primary ? { ...walletToForm(primary), nickname: `${primary.nickname} (secundária)` } : { email: user?.email }}
            onDone={() => setAddingSecondary(false)}
          />
        ) : (
          <p id="secondary-hint" className="mt-2 text-xs text-muted">
            {primary ? 'Você ainda não adicionou uma carteira secundária.' : 'Cadastre a carteira principal antes da secundária.'}
          </p>
        )}
      </section>
    </div>
  )
}
