import { describe, expect, it } from 'vitest'
import {
  applyMove,
  BOARD_CELLS,
  CAMP_CELLS,
  cellId,
  chooseAiMove,
  createInitialGame,
  getLegalMovesForPiece,
  hasPlayerWon,
  MAX_PLIES,
} from './index'
import type { AiDifficulty, GameState } from './index'

// Deterministic PRNG (mulberry32) so semi-random difficulties replay identically.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0

  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function playSelfGame(difficulty: AiDifficulty, random: () => number): GameState {
  let state = createInitialGame()
  // applyMove guarantees a draw by MAX_PLIES; the cap is just a test safety net.
  for (let ply = 0; ply <= MAX_PLIES + 5; ply += 1) {
    if (state.winnerId || state.isDraw) {
      break
    }

    const move = chooseAiMove(state, difficulty, random)

    if (!move) {
      break
    }

    state = applyMove(state, move)
  }

  return state
}

// Build a fully-filled goal camp: `northInGoal` of north's pieces sit in the
// goal (= south camp), south pieces block the remaining goal cells, and every
// other piece parks in north's home. Cells are handed out from disjoint pools
// via running cursors so no two pieces ever share a cell.
function buildGoalPosition(northInGoal: number): GameState {
  const base = createInitialGame()
  const goalCells = CAMP_CELLS.south // north's goal camp
  const parkCells = CAMP_CELLS.north // off-goal parking for everyone else
  let goalCursor = 0
  let parkCursor = 0

  const pieces = base.pieces.map((piece) => {
    if (piece.playerId === 'north' && goalCursor < northInGoal) {
      return { ...piece, cellId: goalCells[goalCursor++] }
    }

    if (piece.playerId === 'south' && goalCursor < goalCells.length) {
      return { ...piece, cellId: goalCells[goalCursor++] }
    }

    return { ...piece, cellId: parkCells[parkCursor++] }
  })

  return { ...base, pieces }
}

describe('中國跳棋核心規則', () => {
  it('建立標準 121 格星形棋盤與 6 個 10 格營區', () => {
    expect(BOARD_CELLS).toHaveLength(121)

    for (const campCells of Object.values(CAMP_CELLS)) {
      expect(campCells).toHaveLength(10)
    }
  })

  it('建立 2 人開局，每方 10 顆棋', () => {
    const game = createInitialGame()
    const northPieces = game.pieces.filter((piece) => piece.playerId === 'north')
    const southPieces = game.pieces.filter((piece) => piece.playerId === 'south')

    expect(game.currentPlayerId).toBe('north')
    expect(northPieces).toHaveLength(10)
    expect(southPieces).toHaveLength(10)
  })

  it('開局營區外緣棋子可以單步移動到空格', () => {
    const game = createInitialGame()
    const edgePiece = game.pieces.find((piece) => piece.cellId === cellId(1, -5))

    expect(edgePiece).toBeDefined()

    const moves = getLegalMovesForPiece(game, edgePiece!.id)
    const stepTargets = moves.filter((move) => move.kind === 'step').map((move) => move.to)

    expect(stepTargets.sort()).toEqual([cellId(0, -4), cellId(1, -4)].sort())
  })

  it('開局營區後排棋子可以跳過前方棋子', () => {
    const game = createInitialGame()
    const backPiece = game.pieces.find((piece) => piece.cellId === cellId(2, -6))

    expect(backPiece).toBeDefined()

    const moves = getLegalMovesForPiece(game, backPiece!.id)
    const jumpTargets = moves.filter((move) => move.kind === 'jump').map((move) => move.to)

    expect(jumpTargets).toContain(cellId(0, -4))
  })

  it('AI 會替目前回合玩家選出合法步', () => {
    const game = createInitialGame()
    const southTurnGame = { ...game, currentPlayerId: 'south' as const }
    const move = chooseAiMove(southTurnGame, 'hard')

    expect(move).not.toBeNull()
    expect(move!.pieceId.startsWith('south-')).toBe(true)

    const nextState = applyMove(southTurnGame, move!)

    expect(nextState.currentPlayerId).toBe('north')
  })
})

describe('勝利與封鎖規則', () => {
  it('終點全滿且自己佔多數時判勝（全進營是 10:0 的特例）', () => {
    expect(hasPlayerWon(buildGoalPosition(10), 'north')).toBe(true)
  })

  it('封鎖規則：對手只卡住最後一格，自己佔 9 格仍判勝', () => {
    const blocked = buildGoalPosition(9)

    expect(hasPlayerWon(blocked, 'north')).toBe(true)
  })

  it('不會誤判：自己只進一格、對手佔多數時不算勝', () => {
    expect(hasPlayerWon(buildGoalPosition(1), 'north')).toBe(false)
  })

  it('終點未填滿時不算勝', () => {
    expect(hasPlayerWon(createInitialGame(), 'north')).toBe(false)
  })
})

describe('遊戲一定會結束（終止性）', () => {
  it('困難 AI 自我對弈會分出勝負，不再卡在收尾', () => {
    const final = playSelfGame('hard', mulberry32(1))

    expect(final.winnerId).not.toBeNull()
    expect(final.isDraw).toBe(false)
    expect(final.turn).toBeLessThan(MAX_PLIES)

    // The declared winner genuinely satisfies the win rule.
    expect(hasPlayerWon(final, final.winnerId!)).toBe(true)
  })

  it('多場普通 AI 對弈都在步數上限內收場（有勝負或和局）', () => {
    for (const seed of [1, 7, 42, 123, 2024, 88888]) {
      const final = playSelfGame('normal', mulberry32(seed))

      expect(final.winnerId !== null || final.isDraw).toBe(true)
      expect(final.turn).toBeLessThanOrEqual(MAX_PLIES + 1)
    }
  })
})

describe('棋譜回放的基礎：重放 moveHistory 能重現盤面', () => {
  it('重放全部記錄可完整重現最終盤面', () => {
    const final = playSelfGame('hard', mulberry32(1))

    let replayed = createInitialGame()
    for (const record of final.moveHistory) {
      replayed = applyMove(replayed, record)
    }

    expect(replayed.turn).toBe(final.turn)
    expect(replayed.winnerId).toBe(final.winnerId)
    expect(replayed.isDraw).toBe(final.isDraw)
    expect(replayed.pieces).toEqual(final.pieces)
  })

  it('重放前半段可重現中途盤面（尚未分出勝負）', () => {
    const final = playSelfGame('hard', mulberry32(1))
    const half = Math.floor(final.moveHistory.length / 2)

    let mid = createInitialGame()
    for (let index = 0; index < half; index += 1) {
      mid = applyMove(mid, final.moveHistory[index])
    }

    expect(mid.moveHistory).toHaveLength(half)
    expect(mid.winnerId).toBeNull()
    expect(mid.lastMove).toEqual(final.moveHistory[half - 1])
  })
})
