/* 🔬 每日殘局真瀏覽器冒煙(playwright-core + 系統 Edge/Chrome)。
 * 跑法:npm run daily:check   (先 npm run build && npx vite preview --port 4185)
 *       線上:CHECK_URL=https://... npm run daily:check
 *
 * ★★ 解法**先用引擎的 BFS 在 node 算好**,再把「每一步點哪兩格」餵給瀏覽器點。
 *   第一版在瀏覽器裡自己寫貪心導航:2 步的題走了 30 步還沒解 ——
 *   那在驗「我的貪心夠不夠聰明」,不是在驗 UI 接線。測試要驗的是接線。
 */
import { chromium } from 'playwright-core'
import {
  applyPuzzleMove,
  gameFromPuzzle,
  isSolved,
  minMovesToGoal,
  puzzlesForDate,
  dailyKey,
} from '../src/core/daily'
import { getLegalMovesForPiece } from '../src/core/game'
import type { CellId } from '../src/core/types'

const URL = process.env.CHECK_URL || 'http://localhost:4185'

/** 用 BFS 當導航,算出「每一步從哪一格走到哪一格」的最短解 */
function solveSteps(puzzleIndex: number): { from: CellId; to: CellId }[] {
  const puzzle = puzzlesForDate(dailyKey())[puzzleIndex]
  let state = gameFromPuzzle(puzzle)
  const steps: { from: CellId; to: CellId }[] = []
  for (let guard = 0; guard < puzzle.minMoves + 2 && !isSolved(state, puzzle); guard += 1) {
    let best: { next: typeof state; from: CellId; to: CellId } | null = null
    let bestLeft = Infinity
    for (const piece of state.pieces) {
      for (const move of getLegalMovesForPiece(state, piece.id)) {
        const next = applyPuzzleMove(state, move)
        const left = minMovesToGoal(next.pieces.map((p) => p.cellId), puzzle.goals, puzzle.minMoves + 1)
        if (left >= 0 && left < bestLeft) {
          bestLeft = left
          best = { next, from: piece.cellId, to: move.to }
        }
      }
    }
    if (!best) break
    steps.push({ from: best.from, to: best.to })
    state = best.next
  }
  if (!isSolved(state, puzzle)) throw new Error(`第 ${puzzleIndex + 1} 題:BFS 導航沒解完(引擎層就有問題)`)
  return steps
}

let browser = null
for (const channel of ['msedge', 'chrome']) {
  try {
    browser = await chromium.launch({ channel, headless: true })
    break
  } catch {
    /* 換下一個 */
  }
}
if (!browser) {
  console.error('找不到系統 Edge/Chrome')
  process.exit(1)
}

let pass = 0
let fail = 0
const ok = (cond: unknown, msg: string, note = '') => {
  if (cond) {
    pass += 1
    console.log('  ✓ ' + msg)
  } else {
    fail += 1
    console.error('  ✗ ' + msg + (note ? ' → ' + note : ''))
  }
}

const page = await browser.newPage({ viewport: { width: 1400, height: 950 } })
const errors: string[] = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(URL + '/?v=' + Date.now(), { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await page.evaluate(() => localStorage.removeItem('checkers:daily:v1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(900)

const panelText = async () =>
  (await page.locator('.panel-section', { hasText: '每日殘局' }).first().innerText()).replace(/\s+/g, ' ')

ok((await page.getByRole('button', { name: /開始今天的每日殘局/ }).count()) === 1, '有「📅 開始今天的每日殘局」鈕')
await page.getByRole('button', { name: /開始今天的每日殘局/ }).click()
await page.waitForTimeout(600)

const p1 = await panelText()
ok(/第 1\/5 題/.test(p1), '面板顯示第 1/5 題', p1.slice(0, 80))
ok(/目標: ?\d+ 步/.test(p1), '面板寫出目標步數', p1.match(/目標:[^・]*/)?.[0] ?? '')

/** 照 BFS 解法,用真點擊走完一題(點棋子格 → 點目標格,走的是 UI 的 selectCell) */
async function playSolution(index: number) {
  const steps = solveSteps(index)
  for (const step of steps) {
    await page.locator(`[data-testid="cell-${step.from}"]`).click({ force: true })
    await page.waitForTimeout(150)
    await page.locator(`[data-testid="cell-${step.to}"]`).click({ force: true })
    await page.waitForTimeout(300)
  }
  return steps.length
}

const used1 = await playSolution(0)
const p2 = await panelText()
ok(/解出來了/.test(p2), `照 BFS 最短解(${used1} 步)用真點擊解掉第 1 題`, p2.slice(0, 110))
ok(/滿分/.test(p2), '走最少步 ⇒ 講「滿分」', p2.match(/解出來了[^🔁]*/)?.[0] ?? '')
ok(/今天已解 1 題/.test(p2), '進度變成「今天已解 1 題」')

const store = await page.evaluate(() => localStorage.getItem('checkers:daily:v1'))
const day = Object.values(JSON.parse(store || '{}'))[0] as { solved?: Record<string, number> } | undefined
ok(Object.keys(day?.solved ?? {}).length === 1, '★ 戰績每題分開記(' + store + ')')

ok((await page.getByRole('button', { name: /下一題/ }).count()) === 1, '★ 解完才出現「📅 下一題」')
await page.getByRole('button', { name: /下一題/ }).click()
await page.waitForTimeout(700)
ok(/第 2\/5 題/.test(await panelText()), '按「下一題」=接第 2 題')

await page.getByRole('button', { name: /離開每日殘局/ }).click()
await page.waitForTimeout(600)
ok(/開始今天的每日殘局/.test(await panelText()), '離開每日模式=回到入口')

ok(errors.length === 0, '整場零 pageerror', errors.join(' | ').slice(0, 200))

await browser.close()
console.log(`\n🔬 daily-check:${pass} 過 / ${fail} 失敗`)
process.exit(fail ? 1 : 0)
