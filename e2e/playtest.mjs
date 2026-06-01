// Automated browser play-through — drives the REAL rendered game and listens
// for crashes/freezes that the Node unit tests (src/core/game.test.ts) cannot
// see (render / animation / Web Worker / timing bugs). This is the harness that
// caught the move-animation freeze (rAF index out of range).
//
// Setup (once):   npx playwright install chromium
// Run (local):    npm run dev   # in another terminal, then:
//                 npm run playtest
// Run (deployed): URL=https://chinese-checker.netlify.app/ npm run playtest
// Options:        ROUNDS=30 DIFFICULTY=hard URL=... node e2e/playtest.mjs
//
// Exits non-zero if any console/page error occurs or the board appears frozen.
import { chromium } from 'playwright'

const URL = process.env.URL || 'http://localhost:5173'
const ROUNDS = Number(process.env.ROUNDS || 20)
const DIFFICULTY = process.env.DIFFICULTY || 'hard'
const errors = []

const browser = await chromium.launch()
const page = await browser.newPage()
// These two listeners are the whole point — they catch the uncaught throw.
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})

console.log(`loading ${URL} (difficulty=${DIFFICULTY}, rounds=${ROUNDS})`)
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.evaluate(() => localStorage.clear()) // start from a clean game
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('.checker-board', { timeout: 20000 })
await page.selectOption('select', DIFFICULTY).catch(() => {})

async function clickCell(id) {
  await page.click(`g[data-cell-id="${id}"]`, { force: true, timeout: 3000 }).catch(() => {})
}

// Generic legal-move driver: select each cell, take the first legal target that appears.
async function makeNorthMove() {
  const cells = await page.$$eval('.board-cell', (els) =>
    els.map((e) => e.getAttribute('data-cell-id')),
  )
  for (const id of cells) {
    await clickCell(id)
    await page.waitForTimeout(70) // let React render legal targets
    const targets = await page.$$eval('.board-cell.is-legal-target', (els) =>
      els.map((e) => e.getAttribute('data-cell-id')),
    )
    if (targets.length > 0) {
      await clickCell(targets[0])
      return `${id}->${targets[0]}`
    }
  }
  return null
}

let frozen = false
for (let round = 1; round <= ROUNDS; round += 1) {
  const moved = await makeNorthMove()
  if (!moved) {
    console.log(`round ${round}: no legal move — board may be FROZEN (a bug)`)
    frozen = true
    break
  }
  await page.waitForTimeout(2200) // animation + AI think + AI animation
  const status = await page.textContent('.turn-badge').catch(() => '?')
  console.log(`round ${round}: ${moved} | status="${(status || '').trim()}" | errors=${errors.length}`)
}

console.log(`\n=== ${errors.length} error(s); frozen=${frozen} ===`)
errors.slice(0, 20).forEach((e) => console.log('  - ' + e))
await browser.close()
process.exit(errors.length || frozen ? 1 : 0)
