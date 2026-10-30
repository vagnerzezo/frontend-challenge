/**
 * Auditoria Lighthouse reprodutível:
 *   1. build otimizado com o cenário padrão dos mocks;
 *   2. vite preview em porta dedicada;
 *   3. N medições por página e perfil (mobile/desktop), relatórios HTML+JSON;
 *   4. mediana por categoria + LCP/CLS/TBT em lighthouse/reports/summary.{json,md}.
 */
import { spawn, execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import * as chromeLauncher from 'chrome-launcher'
import { chromium } from '@playwright/test'

const root = path.resolve(import.meta.dirname, '..')
const cfg = JSON.parse(readFileSync(path.join(root, 'lighthouse/config.json'), 'utf8'))
const outDir = path.join(root, 'lighthouse/reports')
mkdirSync(outDir, { recursive: true })
const port = new URL(cfg.baseUrl).port

if (!process.argv.includes('--skip-build')) {
  console.log('» build otimizado (mocks ativos, cenário padrão)')
  execSync('pnpm build', { cwd: root, stdio: 'inherit', env: { ...process.env, VITE_ENABLE_MOCKS: 'true', VITE_MOCK_LATENCY: 'fast' } })
}

const preview = spawn('pnpm', ['exec', 'vite', 'preview', '--port', port, '--strictPort'], { cwd: root, stdio: 'ignore' })
const cleanup = () => preview.kill()
process.on('exit', cleanup)
for (let i = 0; i < 50; i++) {
  try {
    await fetch(cfg.baseUrl)
    break
  } catch {
    await new Promise((r) => setTimeout(r, 200))
  }
}

const chrome = await chromeLauncher.launch({
  chromePath: process.env.CHROME_PATH || chromium.executablePath(),
  chromeFlags: ['--headless=new', '--no-sandbox'],
})

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
const results = []
try {
  for (const page of cfg.pages) {
    for (const profile of cfg.profiles) {
      const runs = []
      for (let i = 1, attempts = 0; i <= cfg.runs; i++) {
        const url = cfg.baseUrl + page.path
        const flags = { port: chrome.port, output: ['html', 'json'], onlyCategories: cfg.categories, logLevel: 'error' }
        const r = await lighthouse(url, flags, profile === 'desktop' ? desktopConfig : undefined)
        const [html, json] = r.report
        const base = `${page.name}-${profile}-run${i}`
        writeFileSync(path.join(outDir, `${base}.html`), html)
        writeFileSync(path.join(outDir, `${base}.json`), json)
        const lhr = r.lhr
        const metricsOk = ['largest-contentful-paint', 'cumulative-layout-shift', 'total-blocking-time'].every((a) => typeof lhr.audits[a]?.numericValue === 'number')
        if (!metricsOk && attempts++ < 3) {
          console.log(`  ${base}: métricas ausentes (erro transitório do Lighthouse), repetindo medição`)
          i--
          continue
        }
        const run = {
          scores: Object.fromEntries(cfg.categories.map((c) => [c, Math.round(lhr.categories[c].score * 100)])),
          lcp: lhr.audits['largest-contentful-paint'].numericValue,
          cls: lhr.audits['cumulative-layout-shift'].numericValue,
          tbt: lhr.audits['total-blocking-time'].numericValue,
        }
        runs.push(run)
        console.log(`  ${base}:`, JSON.stringify(run.scores), `LCP ${Math.round(run.lcp)}ms CLS ${run.cls.toFixed(3)} TBT ${Math.round(run.tbt)}ms`)
      }
      results.push({
        page: page.name,
        path: page.path,
        profile,
        median: {
          ...Object.fromEntries(cfg.categories.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
          lcpMs: Math.round(median(runs.map((r) => r.lcp))),
          cls: Number(median(runs.map((r) => r.cls)).toFixed(3)),
          tbtMs: Math.round(median(runs.map((r) => r.tbt))),
        },
        runs,
      })
    }
  }
} finally {
  await chrome.kill()
  cleanup()
}

const pkg = (n) => JSON.parse(readFileSync(path.join(root, 'node_modules', n, 'package.json'), 'utf8')).version
const env = {
  date: new Date().toISOString(),
  lighthouse: pkg('lighthouse'),
  chrome: chromium.executablePath().match(/chromium[-_a-z]*-(\d+)/)?.[1] ?? 'playwright chromium',
  node: process.version,
  os: `${os.type()} ${os.release()} ${os.arch()}`,
  cpu: os.cpus()[0]?.model,
  conditions: cfg.notes,
}
writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({ env, targets: cfg.targets, results }, null, 2))

const ok = (cat, v) => (v >= cfg.targets[cat] ? `${v}` : `**${v}** ⚠`)
let md = `# Lighthouse — mediana de ${cfg.runs} medições\n\n`
md += `- Data: ${env.date}\n- Lighthouse ${env.lighthouse} · Chromium (Playwright) · Node ${env.node}\n- Ambiente: ${env.os} · ${env.cpu}\n- Condições: ${env.conditions}\n\n`
md += '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |\n|---|---|---:|---:|---:|---:|---:|---:|---:|\n'
for (const r of results) {
  const m = r.median
  md += `| ${r.page} | ${r.profile} | ${ok('performance', m.performance)} | ${ok('accessibility', m.accessibility)} | ${ok('best-practices', m['best-practices'])} | ${ok('seo', m.seo)} | ${m.lcpMs} ms | ${m.cls} | ${m.tbtMs} ms |\n`
}
md += `\nMetas: Performance ≥ ${cfg.targets.performance}, Accessibility ≥ ${cfg.targets.accessibility}, Best Practices ≥ ${cfg.targets['best-practices']}, SEO ≥ ${cfg.targets.seo}.\n`
writeFileSync(path.join(outDir, 'summary.md'), md)
console.log('\n' + md)
process.exit(0)
