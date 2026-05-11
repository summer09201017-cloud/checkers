import { CAMP_CELLS, getCell } from './board'
import { applyMove, getLegalMoves, getPiecesForPlayer, getPlayer } from './game'
import type { CellId, GameState, LegalMove, PlayerId } from './types'

export type AiDifficulty = 'easy' | 'normal' | 'hard'

export const AI_DIFFICULTY_OPTIONS: Array<{
  value: AiDifficulty
  label: string
  description: string
}> = [
  {
    value: 'easy',
    label: '簡單',
    description: '隨機選擇合法步，適合測試與新手。',
  },
  {
    value: 'normal',
    label: '普通',
    description: '優先往目標營區前進，偶爾保留變化。',
  },
  {
    value: 'hard',
    label: '困難',
    description: '評估全局距離、跳躍路徑與營區位置。',
  },
]

function distanceBetween(cellAId: CellId, cellBId: CellId): number {
  const cellA = getCell(cellAId)
  const cellB = getCell(cellBId)

  return Math.max(
    Math.abs(cellA.x - cellB.x),
    Math.abs(cellA.y - cellB.y),
    Math.abs(cellA.z - cellB.z),
  )
}

function distanceToGoal(cellId: CellId, goalCells: CellId[]): number {
  return Math.min(...goalCells.map((goalCellId) => distanceBetween(cellId, goalCellId)))
}

function boardDistanceScore(state: GameState, playerId: PlayerId): number {
  const player = getPlayer(state, playerId)
  const goalCells = CAMP_CELLS[player.goalCamp]
  const homeCells = new Set(CAMP_CELLS[player.homeCamp])
  const goalCellSet = new Set(goalCells)

  return getPiecesForPlayer(state, playerId).reduce((score, piece) => {
    const distanceScore = distanceToGoal(piece.cellId, goalCells)
    const homePenalty = homeCells.has(piece.cellId) ? 0.35 : 0
    const goalReward = goalCellSet.has(piece.cellId) ? -0.75 : 0

    return score + distanceScore + homePenalty + goalReward
  }, 0)
}

function immediateProgressScore(state: GameState, move: LegalMove): number {
  const player = getPlayer(state, state.currentPlayerId)
  const goalCells = CAMP_CELLS[player.goalCamp]
  const beforeDistance = distanceToGoal(move.from, goalCells)
  const afterDistance = distanceToGoal(move.to, goalCells)
  const jumpBonus = move.kind === 'jump' ? move.path.length * 0.3 : 0

  return beforeDistance - afterDistance + jumpBonus
}

function hardMoveScore(state: GameState, move: LegalMove): number {
  const playerId = state.currentPlayerId
  const afterState = applyMove(state, move)

  if (afterState.winnerId === playerId) {
    return Number.POSITIVE_INFINITY
  }

  const beforeScore = boardDistanceScore(state, playerId)
  const afterScore = boardDistanceScore(afterState, playerId)
  const jumpBonus = move.kind === 'jump' ? move.path.length * 0.45 : 0

  return (beforeScore - afterScore) * 10 + jumpBonus
}

function chooseRandomMove(moves: LegalMove[], random: () => number): LegalMove {
  return moves[Math.floor(random() * moves.length)]
}

function rankMoves(
  moves: LegalMove[],
  scoreMove: (move: LegalMove) => number,
): Array<{ move: LegalMove; score: number }> {
  return moves
    .map((move) => ({ move, score: scoreMove(move) }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score
      }

      if (b.move.path.length !== a.move.path.length) {
        return b.move.path.length - a.move.path.length
      }

      return a.move.to.localeCompare(b.move.to)
    })
}

export function chooseAiMove(
  state: GameState,
  difficulty: AiDifficulty,
  random = Math.random,
): LegalMove | null {
  const moves = getLegalMoves(state)

  if (moves.length === 0) {
    return null
  }

  if (difficulty === 'easy') {
    return chooseRandomMove(moves, random)
  }

  if (difficulty === 'normal') {
    const rankedMoves = rankMoves(moves, (move) => immediateProgressScore(state, move))
    const candidateCount = Math.min(3, rankedMoves.length)

    return chooseRandomMove(
      rankedMoves.slice(0, candidateCount).map((entry) => entry.move),
      random,
    )
  }

  return rankMoves(moves, (move) => hardMoveScore(state, move))[0].move
}
