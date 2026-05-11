export type CellId = string
export type PieceId = string
export type PlayerId = 'north' | 'south'

export type CampId =
  | 'north'
  | 'northEast'
  | 'southEast'
  | 'south'
  | 'southWest'
  | 'northWest'

export type MoveKind = 'step' | 'jump'

export interface AxialCoordinate {
  q: number
  r: number
}

export interface CubeCoordinate extends AxialCoordinate {
  x: number
  y: number
  z: number
}

export interface BoardCell extends CubeCoordinate {
  id: CellId
  camp: CampId | null
}

export interface Player {
  id: PlayerId
  name: string
  homeCamp: CampId
  goalCamp: CampId
  color: string
  colorDark: string
}

export interface Piece {
  id: PieceId
  playerId: PlayerId
  cellId: CellId
}

export interface LegalMove {
  pieceId: PieceId
  from: CellId
  to: CellId
  path: CellId[]
  kind: MoveKind
}

export interface TurnRecord extends LegalMove {
  playerId: PlayerId
}

export interface GameState {
  players: Player[]
  pieces: Piece[]
  currentPlayerId: PlayerId
  turn: number
  winnerId: PlayerId | null
  lastMove: TurnRecord | null
  moveHistory: TurnRecord[]
}
