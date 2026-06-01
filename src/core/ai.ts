import { CAMP_CELLS, cubeDistance } from './board'
import { applyMove, getLegalMoves, getPiecesForPlayer, getPlayer } from './game'
import type { CellId, GameState, LegalMove, PlayerId } from './types'

/**
 * Reward for a piece that already rests inside the goal camp. Must dwarf any
 * single-move distance swing (board distances stay well under 20) so the AI
 * always prefers parking another piece in the goal over shuffling settled
 * pieces — this is what stops the endgame stall.
 */
const SETTLED_GOAL_REWARD = 100

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

function distanceToGoal(cellId: CellId, goalCells: CellId[]): number {
  return Math.min(...goalCells.map((goalCellId) => cubeDistance(cellId, goalCellId)))
}

/**
 * Goal cells that are still empty. Pieces not yet in the goal aim at these
 * instead of "any goal cell": a piece sitting on the camp edge would otherwise
 * report distance ~0 to an already-occupied cell and lose all gradient toward
 * the remaining holes, which is the original endgame stall.
 */
function emptyGoalCells(state: GameState, goalCells: CellId[]): CellId[] {
  const occupied = new Set(state.pieces.map((piece) => piece.cellId))

  return goalCells.filter((goalCellId) => !occupied.has(goalCellId))
}

function boardDistanceScore(state: GameState, playerId: PlayerId): number {
  const player = getPlayer(state, playerId)
  const goalCells = CAMP_CELLS[player.goalCamp]
  const goalCellSet = new Set(goalCells)
  const openGoalCells = emptyGoalCells(state, goalCells)
  // Once the goal is full, fall back to all cells so the metric stays defined.
  const targetCells = openGoalCells.length > 0 ? openGoalCells : goalCells

  return getPiecesForPlayer(state, playerId).reduce((score, piece) => {
    if (goalCellSet.has(piece.cellId)) {
      return score - SETTLED_GOAL_REWARD
    }

    return score + distanceToGoal(piece.cellId, targetCells)
  }, 0)
}

function immediateProgressScore(state: GameState, move: LegalMove): number {
  const player = getPlayer(state, state.currentPlayerId)
  const goalCells = CAMP_CELLS[player.goalCamp]
  const goalCellSet = new Set(goalCells)
  const openGoalCells = emptyGoalCells(state, goalCells)
  const targetCells = openGoalCells.length > 0 ? openGoalCells : goalCells
  const beforeDistance = distanceToGoal(move.from, targetCells)
  const afterDistance = distanceToGoal(move.to, targetCells)
  const settleBonus = !goalCellSet.has(move.from) && goalCellSet.has(move.to) ? 4 : 0
  const jumpBonus = move.kind === 'jump' ? move.path.length * 0.3 : 0

  return beforeDistance - afterDistance + settleBonus + jumpBonus
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
