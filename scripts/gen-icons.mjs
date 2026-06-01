// Rasterize public/app-icon.svg into the PNG sizes the PWA manifest needs.
// Run:  node scripts/gen-icons.mjs   (requires: npx playwright install chromium)
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'public', 'app-icon.svg'), 'utf8')

const targets = [
  { size: 192, file: 'pwa-192x192.png' },
  { size: 512, file: 'pwa-512x512.png' },
  { size: 180, file: 'apple-touch-icon.png' },
]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const { size, file } of targets) {
  const sized = svg.replace('width="512" height="512"', `width="${size}" height="${size}"`)
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<body style="margin:0;padding:0">${sized}</body>`, { waitUntil: 'load' })
  const buf = await page.locator('svg').screenshot({ omitBackground: false })
  writeFileSync(join(root, 'public', file), buf)
  console.log(`wrote public/${file} (${size}x${size})`)
}
await browser.close()
