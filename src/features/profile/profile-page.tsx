import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { passwordChangeSchema, profileSchema } from '@/api/schemas'
import { useProfile, useProfileMutations } from '@/api/queries'
import { isApiError } from '@/api/http'
import { applyServerErrors, Field, PasswordInput, TextInput } from '@/components/form'
import { ErrorState, errorMessage } from '@/components/feedback'
import { Skeleton } from '@/components/ui/skeleton'
import { sessionStore } from '@/session/session-store'
import { announce } from '@/lib/announcer'

// O mesmo formulário edita o perfil e, se algum campo de senha for preenchido, troca a senha
const schema = profileSchema
  .extend({
    currentPassword: z.string().optional(),
    newPassword: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.currentPassword && !data.newPassword && !data.confirmPassword) return

    const result = passwordChangeSchema.safeParse({
      currentPassword: data.currentPassword ?? '',
      newPassword: data.newPassword ?? '',
      confirmPassword: data.confirmPassword ?? '',
    })
    if (result.success) return

    for (const issue of result.error.issues) {
      ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message })
    }
  })

type ProfileFormData = z.infer<typeof schema>
const PROFILE_FIELDS = ['displayName', 'username', 'email', 'walletNickname', 'ensName'] as const
const FIELDS = ['displayName', 'username', 'email', 'walletNickname', 'ensName', 'currentPassword', 'newPassword', 'confirmPassword'] as const

export function ProfilePage() {
  const { data: profile, isPending, isError, error, refetch } = useProfile()
  const { update, uploadAvatar, removeAvatar, changePassword } = useProfileMutations()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const form = useForm<ProfileFormData>({ resolver: zodResolver(schema), mode: 'onSubmit', reValidateMode: 'onChange' })
  const { register, handleSubmit, reset, setError, formState } = form
  const errors = formState.errors

  useEffect(() => {
    if (profile) {
      reset({
        displayName: profile.displayName,
        username: profile.username,
        email: profile.email,
        walletNickname: profile.walletNickname,
        ensName: profile.ensName,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
    }
  }, [profile, reset])

  if (isPending) {
    return (
      <div className="grid gap-5 sm:grid-cols-2" aria-busy="true">
        <span className="sr-only" role="status">
          Carregando perfil…
        </span>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    )
  }
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />

  const saving = update.isPending || changePassword.isPending

  const onSubmit = handleSubmit(async (values) => {
    const profileChanged = PROFILE_FIELDS.some((field) => formState.dirtyFields[field])
    const passwordChanged = !!values.newPassword

    try {
      if (profileChanged) {
        const updated = await update.mutateAsync({
          displayName: values.displayName,
          username: values.username,
          email: values.email,
          walletNickname: values.walletNickname,
          ensName: values.ensName,
        })
        sessionStore.updateUser({
          id: updated.id,
          username: updated.username,
          email: updated.email,
          displayName: updated.displayName,
          avatarUrl: updated.avatarUrl,
        })
      }

      if (passwordChanged) {
        await changePassword.mutateAsync({ currentPassword: values.currentPassword!, newPassword: values.newPassword! })
        form.setValue('currentPassword', '')
        form.setValue('newPassword', '')
        form.setValue('confirmPassword', '')
      }

      const message = profileChanged || passwordChanged ? 'Alterações salvas.' : 'Nenhuma alteração para salvar.'
      toast.success(message)
      announce(message)
    } catch (error) {
      if (isApiError(error) && applyServerErrors(error.fields, setError, FIELDS)) {
        announce('Revise os campos com erro.', 'assertive')
        return
      }
      toast.error(errorMessage(error, 'Não foi possível salvar.'))
    }
  })

  const handleAvatarChange = (file: File | undefined) => {
    if (!file) return
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) {
      toast.error('Use uma imagem PNG, JPG, WebP ou GIF.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter até 2 MB.')
      return
    }
    uploadAvatar.mutate(file, {
      onSuccess: (updated) => {
        sessionStore.updateUser({
          id: updated.id,
          username: updated.username,
          email: updated.email,
          displayName: updated.displayName,
          avatarUrl: updated.avatarUrl,
        })
        toast.success('Avatar atualizado.')
        announce('Avatar atualizado.')
      },
      onError: (error) => toast.error(isApiError(error) ? (error.fields?.avatar ?? error.message) : 'Falha ao enviar avatar.'),
    })
  }

  return (
    <form noValidate onSubmit={onSubmit} className="max-w-3xl">
      <h1 className="mb-5 text-sm font-bold">Perfil do colecionador</h1>
      <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
        <Field label="Nome de exibição" required error={errors.displayName?.message}>
          {(fieldProps) => <TextInput {...fieldProps} autoComplete="name" {...register('displayName')} />}
        </Field>
        <Field label="Nome de usuário" required error={errors.username?.message}>
          {(fieldProps) => <TextInput {...fieldProps} autoComplete="username" {...register('username')} />}
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
        <Field label="Apelido da carteira" required error={errors.walletNickname?.message}>
          {(fieldProps) => <TextInput {...fieldProps} {...register('walletNickname')} />}
        </Field>
        <div>
          <p className="mb-2 text-sm" id="avatar-label">
            Avatar
          </p>
          <div className="flex items-center gap-4" role="group" aria-labelledby="avatar-label">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Seu avatar" width={40} height={40} className="size-10 rounded-full object-cover" data-testid="avatar-image" />
            ) : (
              <span className="grid size-10 place-items-center rounded-full bg-surface-2" aria-label="Sem avatar" role="img">
                <ImageIcon className="size-4 text-muted" aria-hidden />
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              tabIndex={-1}
              aria-label="Arquivo do avatar"
              data-testid="avatar-input"
              onChange={(event) => {
                handleAvatarChange(event.target.files?.[0])
                // limpa para conseguir escolher o mesmo arquivo de novo
                event.target.value = ''
              }}
            />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadAvatar.isPending} className="h-9 rounded-md bg-accent px-5 text-sm font-bold text-accent-ink disabled:opacity-60">
              {uploadAvatar.isPending ? 'Enviando…' : 'Alterar'}
            </button>
            {profile.avatarUrl && (
              <button
                type="button"
                onClick={() =>
                  removeAvatar.mutate(undefined, {
                    onSuccess: (updated) => {
                      sessionStore.updateUser({ id: updated.id, username: updated.username, email: updated.email, displayName: updated.displayName, avatarUrl: null })
                      toast.success('Avatar removido.')
                    },
                    onError: (error) => toast.error(errorMessage(error)),
                  })
                }
                className="text-sm hover:text-accent"
              >
                Remover
              </button>
            )}
          </div>
        </div>
      </div>

      <fieldset className="mt-8 max-w-sm space-y-4">
        <legend className="mb-4 text-sm font-bold">Alterar senha</legend>
        <Field label="Senha atual" error={errors.currentPassword?.message}>
          {(fieldProps) => <PasswordInput {...fieldProps} autoComplete="current-password" {...register('currentPassword')} />}
        </Field>
        <Field label="Nova senha" error={errors.newPassword?.message} hint="Mínimo de 8 caracteres, com letras e números.">
          {(fieldProps) => <PasswordInput {...fieldProps} autoComplete="new-password" {...register('newPassword')} />}
        </Field>
        <Field label="Confirmar nova senha" error={errors.confirmPassword?.message}>
          {(fieldProps) => <PasswordInput {...fieldProps} autoComplete="new-password" {...register('confirmPassword')} />}
        </Field>
      </fieldset>

      <button type="submit" disabled={saving} className="mt-6 h-10 rounded-md bg-accent px-8 text-sm font-bold text-accent-ink hover:bg-accent-strong disabled:opacity-60">
        {saving ? 'Salvando…' : 'Salvar'}
      </button>
    </form>
  )
}
