/** Controles da simulação expostos pelo app (src/mocks/browser.ts). */
interface KurioMockControls {
  updateNft: (id: string, patch: { price?: string; editions?: Record<string, number> }) => Promise<unknown>
  [key: string]: unknown
}
interface Window {
  __kurio?: KurioMockControls
}
