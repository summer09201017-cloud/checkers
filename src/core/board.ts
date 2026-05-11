import type { AxialCoordinate, BoardCell, CampId, CellId, CubeCoordinate } from './types'

export const BOARD_RADIUS = 4
export const CAMP_SIZE = 10

export const DIRECTIONS: AxialCoordinate[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]

export const CAMP_IDS: CampId[] = [
  'north',
  'northEast',
  'southEast',
  'south',
  'southWest',
  'northWest',
]

export function cellId(q: number, r: number): CellId {
  return `${q},${r}`
}

export function axialToCube(q: number, r: number): CubeCoordinate {
  const x = q
  const z = r
  const y = -x - z

  return { q, r, x, y, z }
}

function isBetween(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

function isCentralHex({ x, y, z }: CubeCoordinate): boolean {
  return Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) <= BOARD_RADIUS
}

function getCampForCube({ x, y, z }: CubeCoordinate): CampId | null {
  if (z < -BOARD_RADIUS && isBetween(x, 1, BOARD_RADIUS) && isBetween(y, 1, BOARD_RADIUS)) {
    return 'north'
  }

  if (x > BOARD_RADIUS && isBetween(y, -BOARD_RADIUS, -1) && isBetween(z, -BOARD_RADIUS, -1)) {
    return 'northEast'
  }

  if (y < -BOARD_RADIUS && isBetween(x, 1, BOARD_RADIUS) && isBetween(z, 1, BOARD_RADIUS)) {
    return 'southEast'
  }

  if (z > BOARD_RADIUS && isBetween(x, -BOARD_RADIUS, -1) && isBetween(y, -BOARD_RADIUS, -1)) {
    return 'south'
  }

  if (x < -BOARD_RADIUS && isBetween(y, 1, BOARD_RADIUS) && isBetween(z, 1, BOARD_RADIUS)) {
    return 'southWest'
  }

  if (y > BOARD_RADIUS && isBetween(x, -BOARD_RADIUS, -1) && isBetween(z, -BOARD_RADIUS, -1)) {
    return 'northWest'
  }

  return null
}

function isStarCell(cube: CubeCoordinate): boolean {
  return isCentralHex(cube) || getCampForCube(cube) !== null
}

function createBoard(): BoardCell[] {
  const cells: BoardCell[] = []
  const limit = BOARD_RADIUS * 2

  for (let r = -limit; r <= limit; r += 1) {
    for (let q = -limit; q <= limit; q += 1) {
      const cube = axialToCube(q, r)

      if (isStarCell(cube)) {
        cells.push({
          ...cube,
          id: cellId(q, r),
          camp: getCampForCube(cube),
        })
      }
    }
  }

  return cells.sort((a, b) => a.r - b.r || a.q - b.q)
}

function createCampCells(cells: BoardCell[]): Record<CampId, CellId[]> {
  const campCells = CAMP_IDS.reduce(
    (accumulator, campId) => {
      accumulator[campId] = []
      return accumulator
    },
    {} as Record<CampId, CellId[]>,
  )

  for (const cell of cells) {
    if (cell.camp) {
      campCells[cell.camp].push(cell.id)
    }
  }

  return campCells
}

export const BOARD_CELLS = createBoard()
export const CELL_BY_ID = new Map<CellId, BoardCell>(BOARD_CELLS.map((cell) => [cell.id, cell]))
export const CAMP_CELLS = createCampCells(BOARD_CELLS)

export function hasCell(cellIdValue: CellId): boolean {
  return CELL_BY_ID.has(cellIdValue)
}

export function getCell(cellIdValue: CellId): BoardCell {
  const cell = CELL_BY_ID.get(cellIdValue)

  if (!cell) {
    throw new Error(`Unknown board cell: ${cellIdValue}`)
  }

  return cell
}

export function offsetCellId(
  fromCellId: CellId,
  direction: AxialCoordinate,
  distance = 1,
): CellId | null {
  const from = getCell(fromCellId)
  const nextId = cellId(from.q + direction.q * distance, from.r + direction.r * distance)

  return hasCell(nextId) ? nextId : null
}
