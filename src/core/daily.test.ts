/* 🔬 📅 每日殘局(跳棋・D 型:生成 + 窮舉驗可解)
 *
 * 釘六件:
 *   ①換日線=台北 UTC+8(「全世界同一組」的那條線)
 *   ②★★ **每一題都可解、而且公佈的步數精確**:BFS 找出真正最少步 == puzzle.minMoves
 *     (反向生成保證「有解」,但倒推步數不一定是最短 ⇒ 精確性要單獨證)
 *   ③決定性:同一天必同一組(逐位元)、隔天換一組
 *   ④一組多題:5 題、棋子數與步數遞增(由易到難)、題題不同
 *   ⑤起始局面合法:格子在盤內、不重疊、起點不等於終點(不是已解的題)
 *   ⑥戰績:每題分開記、取最少步、留 60 天、localStorage 壞掉不炸
 *
 * ⚠ 這支會跑 BFS,比別的測試慢(一組約 0.3~1 秒)——所以 ② 只抽驗 12 天,
 *   而不是像別款那樣掃 400 天(掃 400 天 × 5 題 × BFS 會跑好幾分鐘,
 *   那種成本會讓人開始跳過測試,反而更危險)。決定性與合法性那兩段才掃長天期。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  DAILY_SET_SIZE,
  applyDailyResult,
  dailyKey,
  dailySolvedMap,
  gameFromPuzzle,
  applyPuzzleMove,
  isSolved,
  minMovesToGoal,
  puzzlesForDate,
} from './daily'
import { BOARD_CELLS } from './board'
import { getLegalMovesForPiece } from './game'

const CELL_IDS = new Set(BOARD_CELLS.map((c) => c.id))
const sig = (arr: string[]) => [...arr].sort().join('|')

describe('📅 每日殘局:① 換日線(台北 UTC+8)', () => {
  it('UTC 15:59 仍是台北 8/31,16:00 換成 9/01', () => {
    const t = Date.UTC(2026, 7, 31, 15, 59)
    expect(dailyKey(t)).toBe('2026-08-31')
    expect(dailyKey(t + 60_000)).toBe('2026-09-01')
  })
})

describe('📅 每日殘局:② ★★ 每題可解 + 公佈步數精確', () => {
  const keys = Array.from({ length: 12 }, (_, i) => dailyKey(Date.UTC(2026, 7, 31) + i * 86_400_000))

  it.each(keys)('%s 的五題:BFS 最少步 == 公佈步數', (key) => {
    const set = puzzlesForDate(key)
    for (const p of set) {
      // 給 BFS 比公佈值多 1 的預算:若真正最少步更小,這裡就會抓到(精確性)
      const exact = minMovesToGoal(p.start, p.goals, p.minMoves + 1)
      expect(exact, `${p.id} 應該有解`).toBeGreaterThan(0)
      expect(exact, `${p.id} 公佈 ${p.minMoves} 步但實際最少 ${exact} 步`).toBe(p.minMoves)
    }
  }, 30_000)

  it('★ 走法可逆(反向生成的前提):每題的第一步都走得動', () => {
    for (const key of keys.slice(0, 4)) {
      for (const p of puzzlesForDate(key)) {
        const state = gameFromPuzzle(p)
        const anyMove = state.pieces.some((piece) => getLegalMovesForPiece(state, piece.id).length > 0)
        expect(anyMove, `${p.id} 開局就沒有合法步`).toBe(true)
      }
    }
  }, 30_000)

  it('★ 照 BFS 的解法真的走得完(用產品的 applyMove 走,不是自己算)', () => {
    const p = puzzlesForDate('2026-08-31')[0]
    let state = gameFromPuzzle(p)
    let guard = 0
    while (!isSolved(state, p) && guard < 12) {
      guard += 1
      // 貪心:挑「走完之後最少步數變小」的那一步(BFS 當導航)
      let bestNext: typeof state | null = null
      let bestLeft = Infinity
      for (const piece of state.pieces) {
        for (const move of getLegalMovesForPiece(state, piece.id)) {
          const next = applyPuzzleMove(state, move)   // ★ 單人題要把回合轉回解題方
          const cells = next.pieces.map((x) => x.cellId)
          const left = minMovesToGoal(cells, p.goals, p.minMoves + 1)
          if (left >= 0 && left < bestLeft) {
            bestLeft = left
            bestNext = next
          }
        }
      }
      expect(bestNext, '找不到往前的一步').not.toBeNull()
      state = bestNext!
    }
    expect(isSolved(state, p)).toBe(true)
    expect(guard).toBeLessThanOrEqual(p.minMoves)
  }, 60_000)
})

describe('📅 每日殘局:③④ 決定性與一組多題', () => {
  it('同一天必同一組(逐位元)、隔天換一組', () => {
    const a = puzzlesForDate('2026-08-31')
    const b = puzzlesForDate('2026-08-31')
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    const c = puzzlesForDate('2026-09-01')
    expect(JSON.stringify(a.map((p) => p.start))).not.toBe(JSON.stringify(c.map((p) => p.start)))
  })

  it(`一組 ${DAILY_SET_SIZE} 題、棋子數遞增、步數不遞減、題題不同`, () => {
    const set = puzzlesForDate('2026-08-31')
    expect(set).toHaveLength(DAILY_SET_SIZE)
    const ks = set.map((p) => p.start.length)
    expect(ks).toEqual([2, 3, 4, 4, 4])
    const steps = set.map((p) => p.minMoves)
    expect(steps.every((v, i) => i === 0 || steps[i - 1] <= v), `步數應不遞減:${steps}`).toBe(true)
    expect(new Set(set.map((p) => sig(p.start))).size).toBe(set.length)
    expect(new Set(set.map((p) => p.id)).size).toBe(set.length)
  })

  /* ⚠ 60 天不是 400 天:每天要生 5 題(含 BFS),400 天要跑好幾分鐘——
     **測試貴到讓人跳過就是最大的風險**(艦隊鐵則)。60 天已經足以抓到「生成器壞掉」。 */
  it('60 天每天都湊得出完整一組、起始局面都合法', () => {
    for (let i = 0; i < 60; i += 1) {
      const key = dailyKey(Date.UTC(2026, 7, 31) + i * 86_400_000)
      const set = puzzlesForDate(key)
      expect(set, key).toHaveLength(DAILY_SET_SIZE)
      for (const p of set) {
        expect(new Set(p.start).size, `${p.id} 起點重疊`).toBe(p.start.length)
        expect(p.start.every((c) => CELL_IDS.has(c)), `${p.id} 起點出盤`).toBe(true)
        expect(p.goals.every((c) => CELL_IDS.has(c)), `${p.id} 終點出盤`).toBe(true)
        expect(p.goals.length).toBe(p.start.length)
        expect(sig(p.start), `${p.id} 開局就已經解完了`).not.toBe(sig(p.goals))
        expect(p.minMoves).toBeGreaterThan(0)
      }
    }
  }, 120_000)
})

describe('📅 每日殘局:⑥ 戰績(每題分開記)', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    })
  })

  it('每題分開記、取最少步、新紀錄判定', () => {
    const r1 = applyDailyResult('2026-08-31', '2026-08-31#1', 5)
    expect(r1).toMatchObject({ best: 5, isNewBest: true, solvedCount: 1 })
    const r2 = applyDailyResult('2026-08-31', '2026-08-31#1', 7)
    expect(r2).toMatchObject({ best: 5, isNewBest: false })
    const r3 = applyDailyResult('2026-08-31', '2026-08-31#1', 3)
    expect(r3).toMatchObject({ best: 3, isNewBest: true })
    const r4 = applyDailyResult('2026-08-31', '2026-08-31#2', 9)
    expect(r4).toMatchObject({ best: 9, solvedCount: 2 })
    expect(dailySolvedMap('2026-08-31')).toEqual({ '2026-08-31#1': 3, '2026-08-31#2': 9 })
  })

  it('只留最近 60 天', () => {
    for (let i = 0; i < 65; i += 1) {
      const key = dailyKey(Date.UTC(2026, 0, 1) + i * 86_400_000)
      applyDailyResult(key, `${key}#1`, 4)
    }
    const book = JSON.parse(localStorage.getItem('checkers:daily:v1') as string)
    expect(Object.keys(book)).toHaveLength(60)
    expect(book['2026-01-01']).toBeUndefined()
  })

  it('localStorage 全被擋時不炸(私密模式照玩)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(() => applyDailyResult('2026-08-31', '2026-08-31#1', 4)).not.toThrow()
    expect(dailySolvedMap('2026-08-31')).toEqual({})
  })
})
