import { z } from 'zod'

// Validações usadas tanto nos formulários quanto na API simulada (MSW)

const required = (label: string) => z.string().trim().min(1, `${label} é obrigatório.`)

export const emailSchema = z.string().trim().min(1, 'E-mail é obrigatório.').email('Informe um e-mail válido.')
export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Use ao menos 3 caracteres.')
  .max(20, 'Use no máximo 20 caracteres.')
  .regex(/^[a-z0-9_.]+$/, 'Use apenas letras minúsculas, números, ponto ou _.')
export const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter ao menos 8 caracteres.')
  .regex(/[A-Za-z]/, 'Inclua ao menos uma letra.')
  .regex(/[0-9]/, 'Inclua ao menos um número.')
export const ensSchema = z
  .string()
  .trim()
  .min(3, 'Nome ENS deve ter ao menos 3 caracteres.')
  .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*$/, 'Use letras minúsculas, números, hífen ou ponto.')

export const evmAddress = /^0x[a-fA-F0-9]{40}$/
export const solanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export const networkSchema = z.enum(['ethereum', 'polygon', 'solana'], { message: 'Selecione uma rede.' })
export const providerSchema = z.enum(['metamask', 'walletconnect', 'coinbase'], { message: 'Selecione uma carteira.' })

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Senha é obrigatória.'),
})

export const registerSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirme a senha.'),
  })
  .refine((data) => data.password === data.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem.' })

export const profileSchema = z.object({
  displayName: required('Nome de exibição').max(40, 'Use no máximo 40 caracteres.'),
  username: usernameSchema,
  email: emailSchema,
  walletNickname: required('Apelido da carteira').max(30, 'Use no máximo 30 caracteres.'),
  ensName: ensSchema,
})

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem.' })
  .refine((data) => data.newPassword !== data.currentPassword, { path: ['newPassword'], message: 'A nova senha deve ser diferente da atual.' })

const walletBase = z.object({
  displayName: required('Nome de exibição'),
  nickname: required('Apelido da carteira').max(30, 'Use no máximo 30 caracteres.'),
  network: networkSchema,
  profileName: required('Nome do perfil'),
  address: required('Endereço da carteira'),
  secondaryAddress: z.string().trim().optional(),
  provider: providerSchema,
  referralCode: required('Código de indicação').regex(/^[A-Z0-9-]{4,20}$/i, 'Use 4–20 letras, números ou hífen.'),
  email: emailSchema,
  ensName: ensSchema,
})

// retorna a mensagem de erro do endereço ou null se estiver certo
export function addressError(network: string, address: string): string | null {
  if (network === 'solana') {
    return solanaAddress.test(address) ? null : 'Endereço Solana inválido.'
  }
  return evmAddress.test(address) ? null : 'Endereço deve começar com 0x seguido de 40 caracteres hexadecimais.'
}

export const walletSchema = walletBase.superRefine((data, ctx) => {
  const error = addressError(data.network, data.address)
  if (error) ctx.addIssue({ code: 'custom', path: ['address'], message: error })
})

export const checkoutSchema = z
  .object({
    displayName: required('Nome de exibição'),
    username: usernameSchema,
    profileName: required('Nome do perfil'),
    network: networkSchema,
    address: required('Endereço da carteira'),
    secondaryAddress: z.string().trim().optional(),
    provider: providerSchema,
    referralCode: required('Código de indicação'),
    email: emailSchema,
    ensName: ensSchema,
    useOtherWallet: z.boolean(),
    walletId: z.string().optional(),
    note: z.string().max(280, 'Use no máximo 280 caracteres.').optional(),
  })
  .superRefine((data, ctx) => {
    const error = addressError(data.network, data.address)
    if (error) ctx.addIssue({ code: 'custom', path: ['address'], message: error })
    if (!data.useOtherWallet && !data.walletId) ctx.addIssue({ code: 'custom', path: ['walletId'], message: 'Selecione uma carteira cadastrada.' })
  })

export type LoginForm = z.infer<typeof loginSchema>
export type RegisterForm = z.infer<typeof registerSchema>
export type ProfileForm = z.infer<typeof profileSchema>
export type PasswordChangeForm = z.infer<typeof passwordChangeSchema>
export type WalletForm = z.infer<typeof walletSchema>
export type CheckoutForm = z.infer<typeof checkoutSchema>

// transforma os erros do zod em { campo: mensagem }, pegando a primeira mensagem de cada campo
export function zodFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const name = issue.path.join('.') || 'form'
    if (!fields[name]) fields[name] = issue.message
  }
  return fields
}
