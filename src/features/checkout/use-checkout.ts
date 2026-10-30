import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { BuyerInfo, Network, Order, Quote, WalletProvider } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { isApiError, type ApiError } from '@/api/http'
import { keys, useOrder } from '@/api/queries'
import { sessionStore } from '@/session/session-store'
import { announce } from '@/lib/announcer'

// Etapas do checkout: idle → reviewing → connecting → submitting → pending → confirmed/rejected
//
// Cada tentativa de compra é salva no localStorage com uma chave de idempotência.
// Assim, se o usuário clicar duas vezes, der timeout ou recarregar a página,
// a mesma chave é reenviada e a API devolve o MESMO pedido (sem cobrar duas vezes).

export type CheckoutStep = 'idle' | 'reviewing' | 'connecting' | 'submitting' | 'pending' | 'confirmed' | 'rejected' | 'error'

export interface PaymentChoice {
  walletId?: string
  provider: WalletProvider
  network: Network
  address: string
}

interface Attempt {
  key: string
  userId: string
  quoteId: string
  quoteFingerprint: string
  walletSessionId?: string
  orderId?: string
  createdAt: number
}

const PROVIDER_NAMES: Record<WalletProvider, string> = {
  metamask: 'MetaMask',
  coinbase: 'Coinbase Wallet',
  walletconnect: 'WalletConnect',
}

function getStorageKey(userId: string) {
  return `kurio.checkout.attempt.${userId}`
}

function loadAttempt(userId: string): Attempt | null {
  try {
    const saved = localStorage.getItem(getStorageKey(userId))
    if (!saved) return null
    const attempt = JSON.parse(saved) as Attempt
    return attempt.userId === userId ? attempt : null
  } catch {
    return null
  }
}

function saveAttempt(attempt: Attempt | null, userId: string) {
  try {
    if (attempt) localStorage.setItem(getStorageKey(userId), JSON.stringify(attempt))
    else localStorage.removeItem(getStorageKey(userId))
  } catch {
    // localStorage indisponível
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useCheckout(liveQuote: Quote | undefined) {
  const queryClient = useQueryClient()
  const userId = sessionStore.get().user?.id ?? 'anon'
  const [step, setStep] = useState<CheckoutStep>('idle')
  const [reviewQuote, setReviewQuote] = useState<Quote | null>(null)
  // guarda a cotação antiga quando os valores mudam, para mostrar a diferença
  const [previousQuote, setPreviousQuote] = useState<Quote | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [attempt, setAttempt] = useState<Attempt | null>(() => loadAttempt(userId))
  const isSubmittingRef = useRef(false)

  const orderQuery = useOrder(attempt?.orderId ?? null)
  const order = orderQuery.data

  const persist = useCallback(
    (newAttempt: Attempt | null) => {
      setAttempt(newAttempt)
      saveAttempt(newAttempt, userId)
    },
    [userId],
  )

  // depois de um refresh, continua de onde o pedido salvo parou
  useEffect(() => {
    if (!attempt?.orderId || !order) return
    if (order.status === 'pending') setStep('pending')
    else if (order.status === 'confirmed') setStep('confirmed')
    else if (order.status === 'rejected') setStep('rejected')
  }, [attempt?.orderId, order])

  // o pedido salvo não existe mais (ex.: reset dos mocks), então descarta a tentativa
  useEffect(() => {
    const orderError = orderQuery.error
    if (isApiError(orderError) && (orderError.code === 'NOT_FOUND' || orderError.code === 'FORBIDDEN')) {
      persist(null)
      setStep('idle')
    }
  }, [orderQuery.error, persist])

  // o preço mudou enquanto o usuário revisava: busca a cotação nova e pede para confirmar de novo
  const liveFingerprint = liveQuote?.fingerprint
  useEffect(() => {
    if (step !== 'reviewing' || !reviewQuote || !liveFingerprint) return
    if (liveFingerprint !== reviewQuote.fingerprint) {
      setPreviousQuote(reviewQuote)
      setReviewQuote(null)
      setStatusMessage('Os valores mudaram durante a revisão. Revalidando a cotação…')
      api.quoteCart().then(
        (fresh) => {
          setReviewQuote(fresh)
          setStatusMessage(null)
          announce('Os valores do pedido mudaram. Revise e confirme novamente.', 'assertive')
        },
        (error) => setError(error),
      )
    }
  }, [liveFingerprint, step, reviewQuote])

  // abre a revisão buscando uma cotação atualizada na API
  const startReview = useCallback(async () => {
    setError(null)
    setStatusMessage(null)
    setStep('reviewing')
    setReviewQuote(null)
    try {
      const fresh = await api.quoteCart()
      if (liveQuote && fresh.fingerprint !== liveQuote.fingerprint) setPreviousQuote(liveQuote)
      else setPreviousQuote(null)
      setReviewQuote(fresh)
      queryClient.invalidateQueries({ queryKey: ['quote'] })
    } catch (error) {
      setError(error as ApiError)
    }
  }, [liveQuote, queryClient])

  const submit = useCallback(
    async (buyer: BuyerInfo, payment: PaymentChoice) => {
      // evita enviar duas vezes se o usuário clicar rápido
      if (isSubmittingRef.current || !reviewQuote) return
      isSubmittingRef.current = true
      setError(null)

      try {
        // se já existe uma tentativa para a mesma cotação, reaproveita a chave
        let current: Attempt | null = null
        if (attempt && !attempt.orderId && attempt.quoteId === reviewQuote.id) {
          current = attempt
        }
        if (!current) {
          current = {
            key: crypto.randomUUID(),
            userId,
            quoteId: reviewQuote.id,
            quoteFingerprint: reviewQuote.fingerprint,
            createdAt: Date.now(),
          }
          persist(current)
        }

        if (!current.walletSessionId) {
          setStep('connecting')
          setStatusMessage(`Conectando à carteira ${PROVIDER_NAMES[payment.provider]}…`)
          const walletSession = await api.connectWallet({
            walletId: payment.walletId,
            provider: payment.provider,
            network: payment.network,
            address: payment.walletId ? undefined : payment.address,
          })
          current = { ...current, walletSessionId: walletSession.id }
          persist(current)
        }

        setStep('submitting')
        setStatusMessage('Enviando pedido…')
        const body = {
          quoteId: current.quoteId,
          quoteFingerprint: current.quoteFingerprint,
          walletSessionId: current.walletSessionId!,
          buyer,
        }

        // Em caso de timeout ou erro de rede o pedido pode ter sido criado mesmo assim.
        // Tentamos de novo (até 4 vezes) com a MESMA chave para recuperar esse pedido.
        let created: Order | null = null
        for (let tryNumber = 0; tryNumber < 4 && !created; tryNumber++) {
          try {
            created = await api.createOrder(body, current.key)
          } catch (error) {
            const canRetry = isApiError(error) && (error.code === 'TIMEOUT' || error.code === 'NETWORK') && tryNumber < 3
            if (!canRetry) throw error

            setStatusMessage('A resposta demorou. Verificando o pedido sem criar outra compra…')
            announce('A resposta demorou. Verificando o pedido.', 'polite')
            await wait(1000 * (tryNumber + 1))
          }
        }

        const order = created!
        persist({ ...current, orderId: order.id })
        queryClient.setQueryData(keys.order(userId, order.id), order)
        setStep(order.status)
        setStatusMessage(null)
        announce('Pedido enviado. Aguardando confirmação na rede.', 'polite')
      } catch (caught) {
        const error = caught as ApiError

        if (isApiError(error) && error.code === 'QUOTE_STALE') {
          // os valores mudaram: precisa revisar e confirmar de novo, com uma tentativa nova
          const newQuote = error.details?.quote as Quote | undefined
          setPreviousQuote(reviewQuote)
          setReviewQuote(newQuote ?? null)
          if (!newQuote) api.quoteCart().then(setReviewQuote, setError)
          persist(null)
          setStep('reviewing')
          setStatusMessage(null)
          queryClient.invalidateQueries({ queryKey: ['cart'] })
          queryClient.invalidateQueries({ queryKey: ['quote'] })
          announce('Os valores do pedido mudaram. Revise e confirme novamente.', 'assertive')
        } else if (isApiError(error) && (error.code === 'WALLET_DISCONNECTED' || error.code === 'WALLET_REJECTED')) {
          // a carteira caiu: mantém a tentativa, mas precisa conectar de novo
          if (attempt) persist({ ...(loadAttempt(userId) ?? attempt), walletSessionId: undefined })
          setError(error)
          setStep('error')
        } else {
          if (isApiError(error) && (error.code === 'AVAILABILITY_CONFLICT' || error.code === 'IDEMPOTENCY_CONFLICT')) {
            persist(null)
            queryClient.invalidateQueries({ queryKey: ['cart'] })
            queryClient.invalidateQueries({ queryKey: ['quote'] })
          }
          setError(error)
          setStep('error')
        }

        setStatusMessage(null)
        announce(isApiError(error) ? error.message : 'Falha ao enviar o pedido.', 'assertive')
      } finally {
        isSubmittingRef.current = false
      }
    },
    [attempt, persist, queryClient, reviewQuote, userId],
  )

  // depois de um erro ou recusa, a próxima tentativa começa do zero (nova cotação e nova chave)
  const reset = useCallback(() => {
    persist(null)
    setStep('idle')
    setError(null)
    setReviewQuote(null)
    setPreviousQuote(null)
    setStatusMessage(null)
  }, [persist])

  const close = useCallback(() => {
    if (step === 'submitting' || step === 'connecting' || step === 'pending') return
    setStep('idle')
    setError(null)
    setStatusMessage(null)
  }, [step])

  return { step, reviewQuote, previousQuote, error, statusMessage, order, startReview, submit, reset, close, setStep }
}
