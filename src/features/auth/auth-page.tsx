import { useEffect, useState, useSyncExternalStore } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from '@/api/endpoints'
import { isApiError } from '@/api/http'
import { loginSchema, registerSchema, type LoginForm, type RegisterForm } from '@/api/schemas'
import { safeRedirect } from '@/app/search'
import { applyServerErrors, Field, PasswordInput, TextInput } from '@/components/form'
import { FacebookIcon, GoogleIcon } from '@/components/layout/brand-icons'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { HomePage } from '@/features/home/home-page'
import { outOfScope } from '@/lib/out-of-scope'
import { announce } from '@/lib/announcer'
import { cn } from '@/lib/utils'
import { getGuestCartId, rotateGuestCartId } from '@/session/guest-cart'
import { sessionStore } from '@/session/session-store'
import type { Session } from '@/api/contracts'

type Mode = 'login' | 'register'

const desktopQuery = window.matchMedia('(min-width: 768px)')

function useIsDesktop() {
  return useSyncExternalStore(
    (callback) => {
      desktopQuery.addEventListener('change', callback)
      return () => desktopQuery.removeEventListener('change', callback)
    },
    () => desktopQuery.matches,
  )
}

function useAuthSuccess() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { redirect?: string }
  return (session: Session, greeting: string) => {
    sessionStore.signIn(session)
    // a API já juntou o carrinho do visitante com o do usuário
    rotateGuestCartId()
    const message = `${greeting}, ${session.user.displayName}.`
    toast.success(message)
    announce(message)
    navigate({ to: safeRedirect(search.redirect), replace: true })
  }
}

function SocialLogin() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs">
        <span className="h-px flex-1 bg-line" />
        Ou continue com
        <span className="h-px flex-1 bg-line" />
      </div>
      <button type="button" aria-disabled="true" onClick={() => outOfScope('Login com Google')} className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-line text-xs text-muted hover:bg-surface-2">
        <GoogleIcon className="size-4" /> Continuar com Google
      </button>
      <button type="button" aria-disabled="true" onClick={() => outOfScope('Login com Facebook')} className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-line text-xs text-muted hover:bg-surface-2">
        <FacebookIcon className="size-4 text-[#1877f2]" /> Continuar com Facebook
      </button>
    </div>
  )
}

function LoginFormView() {
  const onSuccess = useAuthSuccess()
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, setError, formState } = useForm<LoginForm>({ resolver: zodResolver(loginSchema), mode: 'onSubmit', reValidateMode: 'onChange' })
  const login = useMutation({
    mutationFn: (values: LoginForm) => api.login({ ...values, guestCartId: getGuestCartId() }),
    onSuccess: (session) => onSuccess(session, 'Bem-vindo de volta'),
    onError: (error) => {
      if (isApiError(error) && applyServerErrors(error.fields, setError, ['email', 'password'] as const)) return
      setFormError(isApiError(error) ? error.message : 'Não foi possível entrar.')
    },
  })

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    login.mutate(values)
  })

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      {formError && (
        <p role="alert" className="rounded-md border border-danger/60 p-2 text-xs text-danger">
          {formError}
        </p>
      )}
      <Field label={<span className="sr-only">E-mail</span>} error={formState.errors.email?.message} htmlFor="login-email">
        {(fieldProps) => <TextInput {...fieldProps} type="email" autoComplete="email" placeholder="contato@email.com" className="h-12 md:h-10" {...register('email')} />}
      </Field>
      <Field label={<span className="sr-only">Senha</span>} error={formState.errors.password?.message} htmlFor="login-password">
        {(fieldProps) => <PasswordInput {...fieldProps} autoComplete="current-password" placeholder="Senha" className="h-12 md:h-10" {...register('password')} />}
      </Field>
      <div className="text-right">
        <button type="button" aria-disabled="true" onClick={() => outOfScope('Recuperação de senha')} className="text-xs text-accent hover:underline">
          Esqueceu a senha?
        </button>
      </div>
      <button type="submit" disabled={login.isPending} className="h-12 w-full rounded-lg bg-accent text-sm font-bold text-accent-ink hover:bg-accent-strong disabled:opacity-60 md:h-10 md:rounded-md">
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}

function RegisterFormView() {
  const onSuccess = useAuthSuccess()
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, setError, formState } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema), mode: 'onSubmit', reValidateMode: 'onChange' })
  const signup = useMutation({
    mutationFn: (values: RegisterForm) =>
      api.register({ username: values.username, email: values.email, password: values.password, guestCartId: getGuestCartId() }),
    onSuccess: (session) => onSuccess(session, 'Conta criada. Bem-vindo'),
    onError: (error) => {
      if (isApiError(error) && applyServerErrors(error.fields, setError, ['username', 'email', 'password'] as const)) return
      setFormError(isApiError(error) ? error.message : 'Não foi possível criar a conta.')
    },
  })
  const errors = formState.errors

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    signup.mutate(values)
  })

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      {formError && (
        <p role="alert" className="rounded-md border border-danger/60 p-2 text-xs text-danger">
          {formError}
        </p>
      )}
      <Field label={<span className="sr-only">Nome de usuário</span>} error={errors.username?.message} htmlFor="reg-username">
        {(fieldProps) => <TextInput {...fieldProps} autoComplete="username" placeholder="Nome de usuário" className="h-12 md:h-10" {...register('username')} />}
      </Field>
      <Field label={<span className="sr-only">E-mail</span>} error={errors.email?.message} htmlFor="reg-email">
        {(fieldProps) => <TextInput {...fieldProps} type="email" autoComplete="email" placeholder="Digite seu e-mail" className="h-12 md:h-10" {...register('email')} />}
      </Field>
      <Field label={<span className="sr-only">Senha</span>} error={errors.password?.message} hint="Mínimo de 8 caracteres, com letras e números." htmlFor="reg-password">
        {(fieldProps) => <PasswordInput {...fieldProps} autoComplete="new-password" placeholder="Senha" className="h-12 md:h-10" {...register('password')} />}
      </Field>
      <Field label={<span className="sr-only">Confirmar senha</span>} error={errors.confirmPassword?.message} htmlFor="reg-confirm">
        {(fieldProps) => <PasswordInput {...fieldProps} autoComplete="new-password" placeholder="Confirmar senha" className="h-12 md:h-10" {...register('confirmPassword')} />}
      </Field>
      <button type="submit" disabled={signup.isPending} className="h-12 w-full rounded-lg bg-accent text-sm font-bold text-accent-ink hover:bg-accent-strong disabled:opacity-60 md:h-10 md:rounded-md">
        {signup.isPending ? 'Criando…' : 'Criar conta'}
      </button>
    </form>
  )
}

function AuthContent({ mode, desktop }: { mode: Mode; desktop: boolean }) {
  const search = useSearch({ strict: false }) as { redirect?: string; reason?: 'expired' }
  // no desktop o conteúdo fica dentro de um Dialog, que precisa do título e descrição dele
  const Title = desktop ? DialogTitle : 'h1'
  const Description = desktop ? DialogDescription : 'p'
  return (
    <div className="space-y-5">
      {desktop ? (
        <nav aria-label="Autenticação" className="flex items-center justify-center gap-2 text-lg">
          <Link to="/login" search={search} replace className={mode === 'login' ? 'text-accent' : 'text-cream'} aria-current={mode === 'login' ? 'page' : undefined}>
            Entrar
          </Link>
          <span aria-hidden className="h-5 w-px bg-accent" />
          <Link to="/cadastro" search={search} replace className={mode === 'register' ? 'text-accent' : 'text-cream'} aria-current={mode === 'register' ? 'page' : undefined}>
            Criar conta
          </Link>
        </nav>
      ) : (
        <p className="pt-10 pb-6 text-center text-3xl font-bold tracking-[0.12em]">KURIO</p>
      )}
      <Title className={cn('text-center', desktop ? 'sr-only' : 'text-lg font-bold')}>{mode === 'login' ? 'Entrar' : 'Criar perfil de colecionador'}</Title>
      <Description className={cn('text-center text-xs', !desktop && 'sr-only')}>
        {mode === 'login' ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.' : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'}
      </Description>
      {search.reason === 'expired' && (
        <p role="alert" className="rounded-md border border-accent/60 bg-band p-2 text-center text-xs">
          Sua sessão expirou. Entre novamente para continuar de onde parou.
        </p>
      )}
      {mode === 'login' ? <LoginFormView /> : <RegisterFormView />}
      <SocialLogin />
      {!desktop && (
        <p className="pt-4 text-center text-sm text-muted">
          {mode === 'login' ? (
            <>
              Novo na Kurio?{' '}
              <Link to="/cadastro" search={search} className="text-accent">
                Crie uma conta
              </Link>
            </>
          ) : (
            <>
              Já tem uma conta?{' '}
              <Link to="/login" search={search} className="text-accent">
                Entre
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  )
}

function AuthScreen({ mode }: { mode: Mode }) {
  const desktop = useIsDesktop()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { redirect?: string }
  useEffect(() => {
    if (sessionStore.get().status === 'authenticated') navigate({ to: safeRedirect(search.redirect), replace: true })
  }, [navigate, search.redirect])

  if (!desktop) {
    return (
      <div className="mx-auto min-h-dvh max-w-md px-6 pb-10">
        <AuthContent mode={mode} desktop={false} />
      </div>
    )
  }
  return (
    <>
      <div aria-hidden inert>
        <HomePage />
      </div>
      <Dialog open onOpenChange={(open) => {
          if (!open) navigate({ to: '/', search: {} })
        }}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-none border-0 border-b-8 border-b-accent bg-surface px-14 py-10 sm:max-w-[400px]">
          <AuthContent mode={mode} desktop />
        </DialogContent>
      </Dialog>
    </>
  )
}

export const LoginPage = () => <AuthScreen mode="login" />
export const RegisterPage = () => <AuthScreen mode="register" />
