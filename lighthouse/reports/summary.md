# Lighthouse — mediana de 3 medições

- Data: 2026-10-29T23:04:34.391Z
- Lighthouse 13.6.0 · Chromium (Playwright) · Node v22.23.1
- Ambiente: Darwin 27.2.0 arm64 · Apple M4
- Condições: Build otimizado (vite build) com o cenário padrão dos mocks (VITE_ENABLE_MOCKS=true, latência 'fast'). Perfis: mobile = preset padrão do Lighthouse (Moto G Power, 4x CPU, Slow 4G simulado); desktop = preset desktop.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| inicio | mobile | 96 | 100 | 100 | 100 | 2678 ms | 0.034 | 73 ms |
| inicio | desktop | 100 | 100 | 100 | 100 | 668 ms | 0.001 | 0 ms |
| detalhe | mobile | 96 | 100 | 100 | 100 | 2713 ms | 0.039 | 26 ms |
| detalhe | desktop | 100 | 100 | 100 | 100 | 675 ms | 0.011 | 0 ms |

Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.
