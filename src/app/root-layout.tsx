import { Outlet, useRouterState } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { MobileNav } from '@/components/layout/mobile-nav'
import { Announcer } from '@/components/layout/announcer'
import { RealtimeBanner } from '@/components/layout/realtime-banner'
import { SessionManager } from './session-manager'

const ScenarioPanel = import.meta.env.VITE_ENABLE_MOCKS === 'true' ? lazy(() => import('@/features/devtools/scenario-panel')) : null

// no mobile, login e cadastro ocupam a tela inteira
const FULLSCREEN_PAGES = ['/login', '/cadastro']

export function RootLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isFullscreen = FULLSCREEN_PAGES.includes(pathname)
  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink">
        Pular para o conteúdo
      </a>
      <RealtimeBanner />
      <SiteHeader />
      <main id="conteudo" tabIndex={-1} className="min-h-[100dvh] outline-none">
        <Outlet />
      </main>
      <div className={isFullscreen ? 'hidden md:block' : undefined}>
        <SiteFooter />
      </div>
      {!isFullscreen && <MobileNav />}
      <SessionManager />
      <Announcer />
      <Toaster position="bottom-center" closeButton mobileOffset={{ bottom: 176 }} />
      {ScenarioPanel && (
        <Suspense fallback={null}>
          <ScenarioPanel />
        </Suspense>
      )}
    </>
  )
}
