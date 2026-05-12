import { useEffect, useMemo, useState } from 'react'
import { BOARD_CELLS, CELL_BY_ID, getPlayer } from '../../core'
import type { BoardCell, CellId, GameState, LegalMove, Piece, PlayerId } from '../../core'
import type { CSSProperties, KeyboardEvent } from 'react'
import './ChineseCheckersBoard.css'

export interface PieceVisualStyle {
  color: string
  dark: string
  light: string
}

interface ChineseCheckersBoardProps {
  game: GameState
  selectedPieceId: string | null
  isInteractionDisabled?: boolean
  pieceStyles: Record<PlayerId, PieceVisualStyle>
  legalMoves: LegalMove[]
  hintMove?: LegalMove | null
  onCellSelect: (cellId: CellId) => void
}

interface LayoutCell {
  cell: BoardCell
  x: number
  y: number
}

const SQRT_3 = Math.sqrt(3)
const CELL_SIZE = 28
const BOARD_PADDING = 42

function cellToPoint(cell: BoardCell) {
  return {
    x: CELL_SIZE * SQRT_3 * (cell.q + cell.r / 2),
    y: CELL_SIZE * 1.5 * cell.r,
  }
}

function createLayout() {
  const cells = BOARD_CELLS.map((cell): LayoutCell => ({ cell, ...cellToPoint(cell) }))
  const xs = cells.map((cell) => cell.x)
  const ys = cells.map((cell) => cell.y)
  const minX = Math.min(...xs) - BOARD_PADDING
  const maxX = Math.max(...xs) + BOARD_PADDING
  const minY = Math.min(...ys) - BOARD_PADDING
  const maxY = Math.max(...ys) + BOARD_PADDING

  return {
    cells,
    viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
  }
}

function getPieceStyle(piece: Piece, pieceStyles: Record<PlayerId, PieceVisualStyle>): CSSProperties {
  const pieceStyle = pieceStyles[piece.playerId]

  return {
    '--piece-color': pieceStyle.color,
    '--piece-dark': pieceStyle.dark,
    '--piece-light': pieceStyle.light,
  } as CSSProperties
}

function pathPoints(path: CellId[]): string {
  return path
    .map((pathCellId) => {
      const cell = CELL_BY_ID.get(pathCellId)

      if (!cell) {
        return null
      }

      const point = cellToPoint(cell)
      return `${point.x},${point.y}`
    })
    .filter((point): point is string => point !== null)
    .join(' ')
}

export function ChineseCheckersBoard({
  game,
  selectedPieceId,
  isInteractionDisabled = false,
  pieceStyles,
  legalMoves,
  hintMove,
  onCellSelect,
}: ChineseCheckersBoardProps) {
  const [animation, setAnimation] = useState<{ pieceId: string; turn: number; currentPos: { x: number; y: number } } | null>(null)
  
  const layout = useMemo(() => createLayout(), [])
  const piecesByCell = useMemo(
    () => new Map<CellId, Piece>(game.pieces.map((piece) => [piece.cellId, piece])),
    [game.pieces],
  )
  const legalTargets = useMemo(() => new Set(legalMoves.map((move) => move.to)), [legalMoves])
  const selectedPiece = selectedPieceId
    ? game.pieces.find((piece) => piece.id === selectedPieceId)
    : null
  const lastMovePath = game.lastMove?.path ?? []
  const lastMoveCells = new Set(lastMovePath)

  useEffect(() => {
    if (game.lastMove && game.lastMove.path.length > 1) {
      let canceled = false
      const pathCells = game.lastMove.path.map((id) => {
        const cell = CELL_BY_ID.get(id)
        return cell ? cellToPoint(cell) : { x: 0, y: 0 }
      })

      const startTime = performance.now()
      const durationPerStep = 250 // ms
      const totalDuration = (pathCells.length - 1) * durationPerStep

      setAnimation({ pieceId: game.lastMove.pieceId, turn: game.turn, currentPos: pathCells[0] })

      function step(now: number) {
        if (canceled) return
        const elapsed = now - startTime
        if (elapsed >= totalDuration) {
          setAnimation(null)
          return
        }

        const stepIndex = Math.floor(elapsed / durationPerStep)
        const stepProgress = (elapsed % durationPerStep) / durationPerStep
        
        const start = pathCells[stepIndex]
        const end = pathCells[stepIndex + 1]
        
        // Easing for X and Y linear movement
        // Add a vertical hop effect (sine wave)
        const hopHeight = 16
        const hopY = Math.sin(stepProgress * Math.PI) * hopHeight

        const currentPos = {
          x: start.x + (end.x - start.x) * stepProgress,
          y: start.y + (end.y - start.y) * stepProgress - hopY,
        }

        setAnimation({ pieceId: game.lastMove!.pieceId, turn: game.turn, currentPos })
        requestAnimationFrame(step)
      }

      requestAnimationFrame(step)
      return () => {
        canceled = true
        setAnimation(null)
      }
    }
  }, [game.lastMove, game.turn])

  const effectivelyDisabled = isInteractionDisabled || animation !== null

  function handleKeyDown(event: KeyboardEvent<SVGGElement>, cellId: CellId) {
    if (effectivelyDisabled) {
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onCellSelect(cellId)
    }
  }

  return (
    <svg
      className={`checker-board${effectivelyDisabled ? ' is-interaction-disabled' : ''}`}
      viewBox={layout.viewBox}
      role="img"
      aria-label="中國跳棋棋盤"
    >
      {lastMovePath.length > 1 && (
        <polyline className="move-path last-move-path" points={pathPoints(lastMovePath)} />
      )}

      {selectedPiece &&
        legalMoves.map((move) => (
          <polyline
            key={`${move.pieceId}-${move.to}`}
            className="move-path legal-move-path"
            points={pathPoints(move.path)}
          />
        ))}

      {hintMove && (
        <polyline
          className="move-path hint-move-path"
          points={pathPoints(hintMove.path)}
        />
      )}

      <g className="board-cells">
        {layout.cells.map(({ cell, x, y }) => {
          const isLegalTarget = legalTargets.has(cell.id)
          const isLastMoveCell = lastMoveCells.has(cell.id)
          const className = [
            'board-cell',
            cell.camp ? `camp-${cell.camp}` : 'camp-center',
            isLegalTarget ? 'is-legal-target' : '',
            isLastMoveCell ? 'is-last-move-cell' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <g
              key={cell.id}
              className={className}
              data-cell-id={cell.id}
              data-testid={`cell-${cell.id}`}
              role="button"
              tabIndex={0}
              aria-disabled={effectivelyDisabled}
              aria-label={`棋格 ${cell.id}`}
              onClick={() => {
                if (!effectivelyDisabled) {
                  onCellSelect(cell.id)
                }
              }}
              onKeyDown={(event) => handleKeyDown(event, cell.id)}
            >
              <circle className="touch-area" cx={x} cy={y} r="22" fill="transparent" />
              <circle className="cell-visual" cx={x} cy={y} r="11" />
              {isLegalTarget && <circle className="target-ring" cx={x} cy={y} r="18" />}
            </g>
          )
        })}
      </g>

      <g className="pieces">
        {layout.cells.map(({ cell, x, y }) => {
          const piece = piecesByCell.get(cell.id)

          if (!piece) {
            return null
          }

          const isSelected = piece.id === selectedPieceId
          const isCurrentTurn = piece.playerId === game.currentPlayerId
          const isAnimating = animation && animation.pieceId === piece.id && animation.turn === game.turn
          const className = [
            'piece',
            isSelected ? 'is-selected' : '',
            isCurrentTurn ? 'is-current-turn' : '',
            isAnimating ? 'is-animating' : '',
          ]
            .filter(Boolean)
            .join(' ')
            
          const renderX = isAnimating ? animation.currentPos.x : x
          const renderY = isAnimating ? animation.currentPos.y : y

          return (
            <g
              key={piece.id}
              className={className}
              style={{ ...getPieceStyle(piece, pieceStyles), transform: `translate(${renderX}px, ${renderY}px)` }}
              data-piece-id={piece.id}
              data-testid={`piece-${piece.id}`}
              role="button"
              tabIndex={0}
              aria-disabled={effectivelyDisabled}
              aria-label={`${getPlayer(game, piece.playerId).name}棋子`}
              onClick={() => {
                if (!effectivelyDisabled) {
                  onCellSelect(cell.id)
                }
              }}
              onKeyDown={(event) => handleKeyDown(event, cell.id)}
            >
              <circle className="touch-area" cx={renderX} cy={renderY} r="22" fill="transparent" />
              <ellipse className="piece-shadow" cx={2} cy={5} rx="17" ry="8" />
              <circle className="piece-rim" cx={0} cy={0} r="18" />
              <circle className="piece-body" cx={0} cy={0} r="17" />
              <circle className="piece-glow" cx={-4} cy={-5} r="10" />
              <circle className="piece-highlight" cx={-6} cy={-7} r="4.5" />
            </g>
          )
        })}
      </g>
    </svg>
  )
}
