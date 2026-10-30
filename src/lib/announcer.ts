// Envia uma mensagem para leitores de tela (os elementos ficam no componente <Announcer />)
export function announce(message: string, politeness: 'polite' | 'assertive' = 'polite') {
  const element = document.getElementById(`announcer-${politeness}`)
  if (!element) return

  // limpa antes para a mensagem ser lida de novo mesmo se for repetida
  element.textContent = ''
  setTimeout(() => {
    element.textContent = message
  }, 30)
}
