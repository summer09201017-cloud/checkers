/* 📅 每日殘局(跳棋版)—— D 型:生成 + 窮舉驗可解
 *
 * 題型:「**N 步內把自己這 K 顆棋子全部跳進對面的營**」(單人解謎,沒有對手)。
 * 每天一組 5 題、全世界同一組:日期(台北 UTC+8)→ FNV → mulberry32 決定性亂數。
 *
 * ★★ 可解性怎麼保證(這一款與其他四款最不同的地方):
 *   **反向生成** —— 從「全部棋子已經在目標營裡」的終局出發,倒退 N 步(決定性隨機),
 *   得到的起始局面**天生保證 N 步內可解**(倒推的每一步反過來走就是一組解法)。
 *   比「隨機擺 + 窮舉驗、無解就重擺」便宜太多,而且不會有「今天無解」的風險。
 *   ⚠ 前提=走法可逆:跳棋的 step(走鄰格)顯然可逆;jump(跳過緊鄰的子、落在其後空格)
 *     反向也是同一個條件(從落點跳回原點,中間那顆子還在)⇒ 可逆 ✓。
 *     這條**有測試守著**(daily.test.ts ②:每一題的每一步都要能正著走回去)。
 *
 * ★ 然後再用 **BFS 算真正的最少步數**:倒退 N 步的局面,真正最少可能只要 N-1 步
 *   (倒推路徑不一定是最短解)。題目公佈的步數必須是**精確的最少步**,
 *   不然孩子照最少步走完卻被說「還沒達標」——這是西洋棋「精確 N 步殺」的跳棋版。
 *
 * 為什麼不做「對打型」的每日題:跳棋一局動輒上百手,當每日題太長;
 * 「N 步進營」才是坐下來五分鐘解得完、又能比誰步數少的形狀。
 */
import { BOARD_CELLS, CAMP_CELLS, DIRECTIONS, cellId, cubeDistance } from './board'
import { applyMove, createGameFromSetup, getLegalMovesForPiece } from './game'
import type { CellId, GameState, PlayerId } from './types'

/** 每天出幾題(一組)。★ 5 題=一次坐下來解得完(與棋類每日題同一個數字) */
export const DAILY_SET_SIZE = 5

/* 解題方=**紅方(north)**,目標營=south(對面)。單人題只放這一方的棋子。
   ★★ 為什麼是 north 不是 south:這個 App 的 AI 固定扮演 **south**(useGameController 的
     AI_PLAYER_ID),而 AI 的 effect 只看 currentPlayerId === AI_PLAYER_ID。
     每日題若把解題方設成 south,一進每日模式 AI 就會**搶著幫你走**。
     設成 north ⇒ currentPlayerId 永遠是 north ⇒ AI 天生不觸發,不必另加開關。 */
export const DAILY_SOLVER: PlayerId = 'north'

export interface DailyPuzzle {
  /** 這一題的唯一 id(戰績每題分開記靠它) */
  id: string
  key: string
  /** 今天那一組的第幾題(0 起) */
  n: number
  /** 起始位置(解題方的 K 顆棋子) */
  start: CellId[]
  /** 目標營裡要被填滿的那 K 格 */
  goals: CellId[]
  /** ★ BFS 算出來的**精確**最少步數(不是倒推步數) */
  minMoves: number
  name: string
  hint: string
}

/** 台北時間(UTC+8)的日期——「全世界同一組」需要一條固定的換日線 */
export function dailyKey(now: number = Date.now()): string {
  return new Date(now + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

function dailySeed(key: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CELL_SET = new Set(BOARD_CELLS.map((cell) => cell.id))

/** 一個局面的正規化指紋(位置集合;棋子不分身分 ⇒ 排序後串起來) */
function signature(cells: CellId[]): string {
  return [...cells].sort().join('|')
}

/** 這個局面下,某顆棋子(在 from)能走到哪些格(step 一格 + jump 連跳)。
    ★ 借產品的 getLegalMovesForPiece:規則只有一份,每日題不可能跟對局規則長不一樣。 */
function movesFrom(cells: CellId[], from: CellId): CellId[] {
  const placements = cells.map((c) => ({ cellId: c, playerId: DAILY_SOLVER }))
  const state = createGameFromSetup(placements, DAILY_SOLVER)
  const piece = state.pieces.find((p) => p.cellId === from)
  if (!piece) return []
  return getLegalMovesForPiece(state, piece.id).map((m) => m.to)
}

/** 這個局面的所有後繼局面(換一顆棋子走一步) */
function successors(cells: CellId[]): CellId[][] {
  const out: CellId[][] = []
  for (let i = 0; i < cells.length; i += 1) {
    for (const to of movesFrom(cells, cells[i])) {
      const next = [...cells]
      next[i] = to
      out.push(next)
    }
  }
  return out
}

/* ★ BFS:從 start 到「所有棋子都站在 goals 上」的**精確最少步數**。
   ⚠ 上限 cap 是必須的:狀態空間會爆(K 顆棋子在 121 格)。
     cap 取「倒推步數」即可 —— 我們只要證明「≤ 倒推步數」並找出真正的最少值,
     不需要探索比倒推更深的地方。回 -1 = cap 內找不到(理論上不會,反向生成保證有解)。 */
export function minMovesToGoal(start: CellId[], goals: CellId[], cap: number): number {
  const goalSig = signature(goals)
  if (signature(start) === goalSig) return 0
  let frontier = [start]
  const seen = new Set<string>([signature(start)])
  for (let depth = 1; depth <= cap; depth += 1) {
    const next: CellId[][] = []
    for (const cells of frontier) {
      for (const cand of successors(cells)) {
        const sig = signature(cand)
        if (sig === goalSig) return depth
        if (seen.has(sig)) continue
        seen.add(sig)
        next.push(cand)
      }
    }
    if (next.length === 0) return -1
    frontier = next
  }
  return -1
}

/** 反向生成用:某顆棋子從 from **倒退**一步能到哪(=從候選格正著走能到 from) */
function reverseMovesFrom(cells: CellId[], from: CellId): CellId[] {
  const occupied = new Set(cells)
  const out: CellId[] = []
  for (const cand of CELL_SET) {
    if (occupied.has(cand)) continue
    // 「cand 正著走能到 from」才是合法的倒退一步(用同一份規則算,不自己寫一套)
    const probe = cells.map((c) => (c === from ? cand : c))
    if (movesFrom(probe, cand).includes(from)) out.push(cand)
  }
  return out
}

/* 一題:從終局(K 顆都在目標營)倒退 backSteps 步。
   ★ 倒退時**每一步都換一顆棋子動**,而且避開已出現過的局面(不繞圈)。 */
function generateOne(rng: () => number, k: number, backSteps: number, goalPool: CellId[]): { start: CellId[]; goals: CellId[] } {
  // 目標格:從目標營裡決定性挑 k 格(挑「營內較深」的前 k 格,孩子看得懂「填滿這一區」)
  const goals = goalPool.slice(0, k)
  let cells = [...goals]
  const seen = new Set<string>([signature(cells)])
  for (let step = 0; step < backSteps; step += 1) {
    const order = cells.map((_, i) => i)
    // 決定性洗牌:先試哪顆棋子
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    let moved = false
    for (const idx of order) {
      const here = cells[idx]
      const cands = reverseMovesFrom(cells, here).filter((c) => {
        const probe = cells.map((x, i) => (i === idx ? c : x))
        return !seen.has(signature(probe))
      })
      if (cands.length === 0) continue
      /* ★ 只從「真的把棋子推得更遠」的候選裡挑(離目標格更遠者優先)。
         首版沒有這條:倒推 3 步的題目 BFS 只要 1 步——**倒推在原地繞圈**,
         題目等於沒難度(量出來才發現的:第 1、2 題都只要 1 步)。
         ⇒ 取「距離嚴格變遠」的候選;真的沒有(貼著營了)才退回全部候選。 */
      const d0 = cubeDistance(here, goals[idx] ?? goals[0])
      const farther = cands.filter((c) => cubeDistance(c, goals[idx] ?? goals[0]) > d0)
      const pool2 = farther.length > 0 ? farther : cands
      const pick = pool2[Math.floor(rng() * pool2.length)]
      cells = cells.map((x, i) => (i === idx ? pick : x))
      seen.add(signature(cells))
      moved = true
      break
    }
    if (!moved) break // 走不動了(理論上不會):就用目前的深度,題目照樣可解
  }
  return { start: cells, goals }
}

/** 目標營格子的固定順序(離營口越遠=越「深」的先填,決定性)。
    ★ north 玩家的目標營是 south 營(TWO_PLAYER_SETUP 定的),反之亦然。 */
function goalPoolFor(player: PlayerId): CellId[] {
  const goalCamp = player === 'south' ? 'north' : 'south'
  const cells = [...CAMP_CELLS[goalCamp]]
  // 依 |z| 由大到小(南營在 z 正向最深、北營在負向最深),同層用 id 穩定排序 ⇒ 決定性
  return cells.sort((a, b) => {
    const ca = BOARD_CELLS.find((c) => c.id === a)!
    const cb = BOARD_CELLS.find((c) => c.id === b)!
    return Math.abs(cb.z) - Math.abs(ca.z) || (a < b ? -1 : 1)
  })
}

/* 📅 今天的一組題(n 題)。棋子數 2→(1+n) 顆遞增、倒退步數跟著加 ⇒ 由易到難。
   ★ 全部決定性:同一天必同一組。 */
export function puzzlesForDate(key: string = dailyKey(), count: number = DAILY_SET_SIZE): DailyPuzzle[] {
  const rng = mulberry32(dailySeed(key))
  const pool = goalPoolFor(DAILY_SOLVER)
  const total = Math.max(1, Math.min(count | 0 || 1, 5))
  const out: DailyPuzzle[] = []
  for (let i = 0; i < total; i += 1) {
    const k = 2 + Math.min(i, 2) // 2,3,4,4,4 顆(4 顆以上 BFS 太貴,難度改用步數拉)
    const backSteps = 2 + i // 倒退 2~6 步
    const { start, goals } = generateOne(rng, k, backSteps, pool)
    // ★ 精確最少步:倒推步數只是上限,BFS 才知道真正要幾步
    const exact = minMovesToGoal(start, goals, backSteps)
    out.push({
      id: `${key}#${i + 1}`,
      key,
      n: i,
      start,
      goals,
      minMoves: exact > 0 ? exact : backSteps,
      name: `第 ${i + 1} 題(${k} 顆・${exact > 0 ? exact : backSteps} 步)`,
      /* ⚠ 文案不提顏色也不提「上/下」:解題方是 north(紅方)、目標是**對面**那一區,
         而畫面方位由 renderer 決定 —— 寫死方位/顏色的話,只要哪天換了視角或配色就變成錯的指引
         (首版寫「把藍色棋子走進上面的紅色營區」兩件都說錯,冒煙測試當場抓到)。 */
      hint: i === 0
        ? '把你的棋子全部走進**對面**那一區的亮起格子——先熱身!'
        : `${k} 顆棋子、最少 ${exact > 0 ? exact : backSteps} 步:跳過緊鄰的棋子可以一次前進兩格。`,
    })
  }
  return out
}

/** 題目 → 可以直接玩的 GameState(單人:只有解題方的棋子) */
export function gameFromPuzzle(puzzle: DailyPuzzle): GameState {
  return createGameFromSetup(
    puzzle.start.map((c) => ({ cellId: c, playerId: DAILY_SOLVER })),
    DAILY_SOLVER,
  )
}

/* ★★ 單人題專用的走一步:走完之後**把回合轉回解題方**。
   為什麼需要它:這是「單人解謎接在雙人引擎上」的必然接縫 ——
   產品的 applyMove 會 `currentPlayerId: getNextPlayerId(state)` 把回合交給對手,
   而 getLegalMovesForPiece 又檢查「這顆子屬於當前玩家」⇒ 每日題只有解題方的棋子,
   **第二步就一顆都動不了**(首跑測試就是死在這:「找不到往前的一步」)。
   ★ 刻意不改 game.ts:對局那條路是對的,不能為了單人題去動它。 */
export function applyPuzzleMove(state: GameState, move: Parameters<typeof applyMove>[1]): GameState {
  const next = applyMove(state, move)
  return { ...next, currentPlayerId: DAILY_SOLVER }
}

/** 這個局面算不算解完了(所有棋子都站在目標格上) */
export function isSolved(state: GameState, puzzle: DailyPuzzle): boolean {
  const here = state.pieces.filter((p) => p.playerId === DAILY_SOLVER).map((p) => p.cellId)
  return signature(here) === signature(puzzle.goals)
}

/* ══ 戰績:{ "YYYY-MM-DD": { solved: { 題id: 那題最少步數 } } } ══
   一天一組多題 ⇒ 每題分開記;零上傳、包 try/catch、只留 60 天。 */
const STORE_KEY = 'checkers:daily:v1'

export function loadDailyBook(): Record<string, { solved: Record<string, number> }> {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function dailySolvedMap(key: string): Record<string, number> {
  const day = loadDailyBook()[key]
  return day && typeof day === 'object' && day.solved ? day.solved : {}
}

export function applyDailyResult(
  key: string,
  puzzleId: string,
  moves: number,
): { best: number; isNewBest: boolean; solvedCount: number } {
  const all = loadDailyBook()
  const day = all[key] && all[key].solved ? all[key] : { solved: {} }
  const prev = day.solved[puzzleId] | 0
  const isNewBest = !prev || moves < prev
  if (isNewBest) day.solved[puzzleId] = moves
  all[key] = day
  const days = Object.keys(all).sort()
  while (days.length > 60) {
    const oldest = days.shift()
    if (oldest) delete all[oldest]
  }
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(all))
  } catch {
    /* 私密模式:這題照玩,只是記不住 */
  }
  return { best: day.solved[puzzleId], isNewBest, solvedCount: Object.keys(day.solved).length }
}

// 讓沒用到的 import 不被 tree-shake 警告(cellId/DIRECTIONS 供未來擴充用的公開再匯出)
export { cellId, DIRECTIONS }
