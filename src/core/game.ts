import { CAMP_CELLS, CAMP_SIZE, cubeDistance, DIRECTIONS, offsetCellId } from './board'
import type {
  CellId,
  GameState,
  LegalMove,
  Piece,
  PieceId,
  Player,
  PlayerId,
  TurnRecord,
} from './types'

/** Hard ceiling on total plies; reaching it ends the game in a draw. */
export const MAX_PLIES = 400
/** Plies of no distance-to-goal progress before declaring a draw. */
export const STALL_PLIES = 100

export const TWO_PLAYER_SETUP: Player[] = [
  {
    id: 'north',
    name: '紅方',
    homeCamp: 'north',
    goalCamp: 'south',
    color: '#d84e45',
    colorDark: '#982b2c',
  },
  {
    id: 'south',
    name: '藍方',
    homeCamp: 'south',
    goalCamp: 'north',
    color: '#2f6dd6',
    colorDark: '#18448f',
  },
]

function sortCampForSetup(cellIds: CellId[], playerId: PlayerId): CellId[] {
  return [...cellIds].sort((a, b) => {
    const [aqText, arText] = a.split(',')
    const [bqText, brText] = b.split(',')
    const aq = Number(aqText)
    const ar = Number(arText)
    const bq = Number(bqText)
    const br = Number(brText)

    if (playerId === 'south') {
      return br - ar || bq - aq
    }

    return ar - br || aq - bq
  })
}

function createPiecesForPlayer(player: Player): Piece[] {
  return sortCampForSetup(CAMP_CELLS[player.homeCamp], player.id)
    .slice(0, CAMP_SIZE)
    .map((cellIdValue, index) => ({
      id: `${player.id}-${index + 1}`,
      playerId: player.id,
      cellId: cellIdValue,
    }))
}

export function createInitialGame(): GameState {
  const base: GameState = {
    players: TWO_PLAYER_SETUP,
    pieces: TWO_PLAYER_SETUP.flatMap(createPiecesForPlayer),
    currentPlayerId: 'north',
    turn: 1,
    winnerId: null,
    isDraw: false,
    bestDistanceToGoal: 0,
    movesSinceProgress: 0,
    lastMove: null,
    moveHistory: [],
  }

  return { ...base, bestDistanceToGoal: combinedDistanceToGoals(base) }
}

/**
 * Build a fresh, playable game from an arbitrary placement of pieces and a
 * side to move. Powers the position editor (author puzzles / teaching setups)
 * and is equally handy for authoring hand-built test positions in unit tests.
 * Piece ids are regenerated per player so the result is well-formed.
 */
export function createGameFromSetup(
  placements: Array<{ cellId: CellId; playerId: PlayerId }>,
  currentPlayerId: PlayerId = 'north',
): GameState {
  const counts: Record<PlayerId, number> = { north: 0, south: 0 }
  const pieces: Piece[] = placements.map(({ cellId: pieceCellId, playerId }) => {
    counts[playerId] += 1
    return { id: `${playerId}-${counts[playerId]}`, playerId, cellId: pieceCellId }
  })

  const base: GameState = {
    players: TWO_PLAYER_SETUP,
    pieces,
    currentPlayerId,
    turn: 1,
    winnerId: null,
    isDraw: false,
    bestDistanceToGoal: 0,
    movesSinceProgress: 0,
    lastMove: null,
    moveHistory: [],
  }

  return { ...base, bestDistanceToGoal: combinedDistanceToGoals(base) }
}

export function getPlayer(state: GameState, playerId: PlayerId): Player {
  const player = state.players.find((candidate) => candidate.id === playerId)

  if (!player) {
    throw new Error(`Unknown player: ${playerId}`)
  }

  return player
}

export function getCurrentPlayer(state: GameState): Player {
  return getPlayer(state, state.currentPlayerId)
}

export function getPiece(state: GameState, pieceId: PieceId): Piece | null {
  return state.pieces.find((piece) => piece.id === pieceId) ?? null
}

export function getPieceAt(state: GameState, cellIdValue: CellId): Piece | null {
  return state.pieces.find((piece) => piece.cellId === cellIdValue) ?? null
}

export function getPiecesForPlayer(state: GameState, playerId: PlayerId): Piece[] {
  return state.pieces.filter((piece) => piece.playerId === playerId)
}

function getOccupiedCells(state: GameState): Set<CellId> {
  return new Set(state.pieces.map((piece) => piece.cellId))
}

function distanceToNearestGoalCell(cellId: CellId, goalCells: CellId[]): number {
  let nearest = Number.POSITIVE_INFINITY

  for (const goalCellId of goalCells) {
    const distance = cubeDistance(cellId, goalCellId)

    if (distance < nearest) {
      nearest = distance
    }
  }

  return nearest
}

/**
 * Sum, over every piece of every player, of its distance to the nearest cell
 * of that player's goal camp. A move that advances any piece toward its goal
 * lowers this number; pure shuffling never sets a new low — which is how
 * applyMove detects a stall and declares a draw.
 */
function combinedDistanceToGoals(state: GameState): number {
  const goalCellsByPlayer = new Map(
    state.players.map((player) => [player.id, CAMP_CELLS[player.goalCamp]]),
  )

  return state.pieces.reduce((total, piece) => {
    const goalCells = goalCellsByPlayer.get(piece.playerId)

    return goalCells ? total + distanceToNearestGoalCell(piece.cellId, goalCells) : total
  }, 0)
}

function getNextPlayerId(state: GameState): PlayerId {
  const currentIndex = state.players.findIndex((player) => player.id === state.currentPlayerId)
  const nextIndex = (currentIndex + 1) % state.players.length

  return state.players[nextIndex].id
}

function dedupeJumpMoves(moves: LegalMove[]): LegalMove[] {
  const shortestByTarget = new Map<CellId, LegalMove>()

  for (const move of moves) {
    const existing = shortestByTarget.get(move.to)

    if (!existing || move.path.length < existing.path.length) {
      shortestByTarget.set(move.to, move)
    }
  }

  return [...shortestByTarget.values()].sort(
    (a, b) => a.path.length - b.path.length || a.to.localeCompare(b.to),
  )
}

function getJumpMoves(piece: Piece, occupiedWithoutPiece: Set<CellId>): LegalMove[] {
  const moves: LegalMove[] = []
  const visited = new Set<CellId>([piece.cellId])

  function walk(fromCellId: CellId, path: CellId[]) {
    for (const direction of DIRECTIONS) {
      const middleCellId = offsetCellId(fromCellId, direction)
      const landingCellId = offsetCellId(fromCellId, direction, 2)

      if (!middleCellId || !landingCellId) {
        continue
      }

      if (
        !occupiedWithoutPiece.has(middleCellId) ||
        occupiedWithoutPiece.has(landingCellId) ||
        visited.has(landingCellId)
      ) {
        continue
      }

      const nextPath = [...path, landingCellId]
      const move: LegalMove = {
        pieceId: piece.id,
        from: piece.cellId,
        to: landingCellId,
        path: nextPath,
        kind: 'jump',
      }

      moves.push(move)
      visited.add(landingCellId)
      walk(landingCellId, nextPath)
      visited.delete(landingCellId)
    }
  }

  walk(piece.cellId, [piece.cellId])

  return dedupeJumpMoves(moves)
}

export function getLegalMovesForPiece(state: GameState, pieceId: PieceId): LegalMove[] {
  if (state.winnerId || state.isDraw) {
    return []
  }

  const piece = getPiece(state, pieceId)

  if (!piece || piece.playerId !== state.currentPlayerId) {
    return []
  }

  const occupied = getOccupiedCells(state)
  const stepMoves = DIRECTIONS.flatMap((direction): LegalMove[] => {
    const to = offsetCellId(piece.cellId, direction)

    if (!to || occupied.has(to)) {
      return []
    }

    return [
      {
        pieceId: piece.id,
        from: piece.cellId,
        to,
        path: [piece.cellId, to],
        kind: 'step',
      },
    ]
  })

  const occupiedWithoutPiece = new Set(occupied)
  occupiedWithoutPiece.delete(piece.cellId)

  return [...stepMoves, ...getJumpMoves(piece, occupiedWithoutPiece)]
}

export function getLegalMoves(state: GameState): LegalMove[] {
  return getPiecesForPlayer(state, state.currentPlayerId).flatMap((piece) =>
    getLegalMovesForPiece(state, piece.id),
  )
}

export function findLegalMove(
  state: GameState,
  pieceId: PieceId,
  targetCellId: CellId,
): LegalMove | null {
  return getLegalMovesForPiece(state, pieceId).find((move) => move.to === targetCellId) ?? null
}

export function hasPlayerWon(state: GameState, playerId: PlayerId): boolean {
  const player = getPlayer(state, playerId)
  const goalCells = CAMP_CELLS[player.goalCamp]
  const occupantByCell = new Map(state.pieces.map((piece) => [piece.cellId, piece.playerId]))

  let filled = 0
  let ownInGoal = 0

  for (const goalCellId of goalCells) {
    const occupant = occupantByCell.get(goalCellId)

    if (occupant) {
      filled += 1

      if (occupant === playerId) {
        ownInGoal += 1
      }
    }
  }

  const blockers = filled - ownInGoal

  // The goal camp is the opponent's home, so requiring all ten own pieces lets
  // a single parked opponent piece make winning impossible. Instead: win when
  // the goal camp is completely full and the player holds the majority of it.
  // A clean sweep (all ten own pieces home) is just the ownInGoal === 10 case;
  // the majority test blocks both false wins from a parked opponent piece and
  // the unwinnable deadlock from one stray blocker on the final cell.
  return filled === goalCells.length && ownInGoal > blockers
}

export function applyMove(state: GameState, requestedMove: LegalMove): GameState {
  const move = findLegalMove(state, requestedMove.pieceId, requestedMove.to)

  if (!move) {
    throw new Error(`Illegal move for ${requestedMove.pieceId} to ${requestedMove.to}`)
  }

  const movedPiece = getPiece(state, move.pieceId)

  if (!movedPiece) {
    throw new Error(`Unknown piece: ${move.pieceId}`)
  }

  const pieces = state.pieces.map((piece) =>
    piece.id === move.pieceId ? { ...piece, cellId: move.to } : piece,
  )
  const turnRecord: TurnRecord = {
    ...move,
    playerId: movedPiece.playerId,
  }
  const advanced: GameState = {
    ...state,
    pieces,
    currentPlayerId: getNextPlayerId(state),
    turn: state.turn + 1,
    lastMove: turnRecord,
    moveHistory: [...state.moveHistory, turnRecord],
  }

  const winnerId = hasPlayerWon(advanced, movedPiece.playerId) ? movedPiece.playerId : null

  const distance = combinedDistanceToGoals(advanced)
  const improved = distance < state.bestDistanceToGoal
  const bestDistanceToGoal = improved ? distance : state.bestDistanceToGoal
  const movesSinceProgress = improved ? 0 : state.movesSinceProgress + 1
  const isDraw =
    !winnerId && (advanced.turn > MAX_PLIES || movesSinceProgress >= STALL_PLIES)

  return {
    ...advanced,
    winnerId,
    isDraw,
    bestDistanceToGoal,
    movesSinceProgress,
  }
}
