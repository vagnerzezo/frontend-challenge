// id do carrinho de quem ainda não fez login (fica salvo para sobreviver ao refresh)
const STORAGE_KEY = 'kurio.guestCartId'
let guestCartId: string | null = null

export function getGuestCartId(): string {
  if (guestCartId) return guestCartId

  try {
    guestCartId = localStorage.getItem(STORAGE_KEY)
    if (!guestCartId) {
      guestCartId = crypto.randomUUID()
      localStorage.setItem(STORAGE_KEY, guestCartId)
    }
  } catch {
    guestCartId ??= crypto.randomUUID()
  }
  return guestCartId
}

// depois do login o carrinho do visitante é juntado ao do usuário, então criamos um novo vazio
export function rotateGuestCartId() {
  guestCartId = crypto.randomUUID()
  try {
    localStorage.setItem(STORAGE_KEY, guestCartId)
  } catch {
    // localStorage indisponível, segue só em memória
  }
}
