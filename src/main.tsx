import '@fontsource-variable/roboto-mono/wght.css'
import './index.css'

async function start() {
  // O MSW precisa iniciar antes de importar o app, porque o socket.io
  // guarda o WebSocket global no momento do import.
  if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
    const { startMocks } = await import('./mocks/browser')
    await startMocks()
  }
  const { renderApp } = await import('./app/app')
  renderApp(document.getElementById('root')!)
}

start()
