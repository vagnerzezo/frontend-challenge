import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { createQueryClient } from '@/api/queries'
import { createAppRouter } from '@/app/router'
import { RealtimeProvider } from '@/realtime/realtime-provider'

export function renderApp(element: HTMLElement) {
  const queryClient = createQueryClient()
  const router = createAppRouter(queryClient)
  createRoot(element).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RealtimeProvider>
          <RouterProvider router={router} />
        </RealtimeProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}
