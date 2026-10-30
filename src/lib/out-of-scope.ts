import { toast } from 'sonner'
import { announce } from './announcer'

// Avisa que a funcionalidade não existe nesta demonstração
export function outOfScope(feature: string) {
  const message = `${feature} não está disponível nesta demonstração.`
  toast.info(message, { id: `oos-${feature}` })
  announce(message)
}
