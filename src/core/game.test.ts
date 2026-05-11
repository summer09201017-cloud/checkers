import { describe, expect, it } from 'vitest'
import {
  applyMove,
  BOARD_CELLS,
  CAMP_CELLS,
  cellId,
  chooseAiMove,
  createInitialGame,
  getLegalMovesForPiece,
} from './index'

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
