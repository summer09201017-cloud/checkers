import { describe, expect, it } from 'vitest'
import { applyMove, chooseAiMove, createInitialGame } from '../core'
import { decodeMovesToGame, encodeMoves } from './share'

describe('分享連結：棋譜編碼往返', () => {
  it('編碼再解碼能完整重現對局盤面', () => {
    let state = createInitialGame()
    for (let i = 0; i < 12; i += 1) {
      const move = chooseAiMove(state, 'hard') // deterministic
      if (!move) break
      state = applyMove(state, move)
    }

    const restored = decodeMovesToGame(encodeMoves(state))

    expect(restored).not.toBeNull()
    expect(restored!.turn).toBe(state.turn)
    expect(restored!.currentPlayerId).toBe(state.currentPlayerId)
    expect(restored!.moveHistory).toHaveLength(state.moveHistory.length)
    expect(restored!.pieces).toEqual(state.pieces)
  })

  it('空對局也能往返（初始盤面）', () => {
    const restored = decodeMovesToGame(encodeMoves(createInitialGame()))
    expect(restored).not.toBeNull()
    expect(restored!.moveHistory).toHaveLength(0)
  })

  it('壞掉/亂填的連結回傳 null，不丟錯', () => {
    expect(decodeMovesToGame('')).toBeNull()
    expect(decodeMovesToGame('not valid base64 !!')).toBeNull()
    expect(decodeMovesToGame('eyJoZWxsbyI6MX0')).toBeNull() // valid base64, wrong shape
  })
})
