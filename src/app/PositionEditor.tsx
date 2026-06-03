import { useMemo, useState } from 'react'
import { createGameFromSetup, createInitialGame } from '../core'
import type { CellId, GameState, PlayerId } from '../core'
import { ChineseCheckersBoard } from '../renderers/svg2d/ChineseCheckersBoard'
import type { PieceVisualStyle } from '../renderers/svg2d/ChineseCheckersBoard'
import type { ThemeId } from './appearance'
import './PositionEditor.css'

type Brush = PlayerId | 'erase'
const MAX_PER_SIDE = 10

interface PositionEditorProps {
  initialGame: GameState
  themeId: ThemeId
  pieceStyles: Record<PlayerId, PieceVisualStyle>
  onApply: (state: GameState) => void
  onCancel: () => void
}

function placementsFromPieces(pieces: GameState['pieces']): Record<CellId, PlayerId> {
  const map: Record<CellId, PlayerId> = {}
  for (const piece of pieces) {
    map[piece.cellId] = piece.playerId
  }
  return map
}

export function PositionEditor({
  initialGame,
  themeId,
  pieceStyles,
  onApply,
  onCancel,
}: PositionEditorProps) {
  // Seed from the current game so you tweak the live position.
  const [placements, setPlacements] = useState<Record<CellId, PlayerId>>(() =>
    placementsFromPieces(initialGame.pieces),
  )
  const [brush, setBrush] = useState<Brush>('north')
  const [turn, setTurn] = useState<PlayerId>(initialGame.currentPlayerId)

  const entries = useMemo(
    () => Object.entries(placements).map(([cellId, playerId]) => ({ cellId, playerId })),
    [placements],
  )
  const editorGame = useMemo(() => createGameFromSetup(entries, turn), [entries, turn])
  const northCount = entries.filter((entry) => entry.playerId === 'north').length
  const southCount = entries.filter((entry) => entry.playerId === 'south').length

  function paint(cellId: CellId) {
    setPlacements((prev) => {
      if (brush === 'erase') {
        if (!(cellId in prev)) return prev
        const next = { ...prev }
        delete next[cellId]
        return next
      }
      if (prev[cellId] === brush) return prev
      const sideCount = Object.values(prev).filter((p) => p === brush).length
      if (sideCount >= MAX_PER_SIDE) return prev // at cap (10 per side)
      return { ...prev, [cellId]: brush }
    })
  }

  return (
    <main className="app-shell editor-shell" data-theme={themeId}>
      <header className="editor-header">
        <h1>盤面編輯器</h1>
        <p className="control-note">點格子放／擦棋子，設定先手後「套用並開始」。可用來出題、教學或做測試盤面。</p>
      </header>

      <div className="editor-board">
        <ChineseCheckersBoard
          game={editorGame}
          selectedPieceId={null}
          isInteractionDisabled={false}
          pieceStyles={pieceStyles}
          legalMoves={[]}
          onCellSelect={paint}
        />
      </div>

      <div className="editor-controls">
        <div className="editor-row">
          <span className="editor-label">畫筆</span>
          <div className="segmented-control editor-brush" aria-label="畫筆">
            <button type="button" className={brush === 'north' ? 'is-active' : ''} onClick={() => setBrush('north')}>
              紅子
            </button>
            <button type="button" className={brush === 'south' ? 'is-active' : ''} onClick={() => setBrush('south')}>
              藍子
            </button>
            <button type="button" className={brush === 'erase' ? 'is-active' : ''} onClick={() => setBrush('erase')}>
              橡皮擦
            </button>
          </div>
        </div>

        <div className="editor-row">
          <span className="editor-label">先手</span>
          <div className="segmented-control" aria-label="先手">
            <button type="button" className={turn === 'north' ? 'is-active' : ''} onClick={() => setTurn('north')}>
              紅方
            </button>
            <button type="button" className={turn === 'south' ? 'is-active' : ''} onClick={() => setTurn('south')}>
              藍方
            </button>
          </div>
        </div>

        <p className="control-note">紅 {northCount}/10 · 藍 {southCount}/10</p>

        <div className="button-row">
          <button type="button" onClick={() => setPlacements(placementsFromPieces(createInitialGame().pieces))}>
            標準開局
          </button>
          <button type="button" onClick={() => setPlacements({})}>
            清空
          </button>
          <button type="button" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="editor-apply"
            onClick={() => onApply(editorGame)}
            disabled={northCount === 0 && southCount === 0}
          >
            套用並開始
          </button>
        </div>
      </div>
    </main>
  )
}
