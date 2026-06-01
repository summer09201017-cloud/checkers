import { AI_DIFFICULTY_OPTIONS, BOARD_CELLS } from './core'
import { useGameController } from './app/useGameController'
import { MoveLog } from './app/MoveLog'
import { VictoryOverlay } from './app/VictoryOverlay'
import { ChineseCheckersBoard } from './renderers/svg2d/ChineseCheckersBoard'
import {
  PIECE_COLOR_OPTIONS,
  THEME_OPTIONS,
  getPieceColorOption,
} from './app/appearance'
import { loadPreferences, savePreferences } from './app/storage'
import { soundManager } from './app/sound'
import type { PieceVisualStyle } from './renderers/svg2d/ChineseCheckersBoard'
import type { AiDifficulty, PlayerId } from './core'
import type { PieceColorId, ThemeId } from './app/appearance'
import type { CSSProperties, ChangeEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import './App.css'

function App() {
  const prefs = useMemo(() => loadPreferences(), [])
  const [themeId, setThemeId] = useState<ThemeId>(prefs.themeId)
  const [pieceColorSelection, setPieceColorSelection] = useState(prefs.pieceColorSelection)
  const [isMuted, setIsMuted] = useState(soundManager.getMuted())
  const [isBgmPlaying, setIsBgmPlaying] = useState(soundManager.getBgmPlaying())
  const [isOverlayDismissed, setIsOverlayDismissed] = useState(false)
  const {
    game,
    viewedGame,
    isReplaying,
    replayIndex,
    currentPlayer,
    aiDifficulty,
    aiPlayer,
    winner,
    isAiTurn,
    isAiThinking,
    isOpponentAiEnabled,
    selectedPiece,
    selectedPieceId,
    legalMoves,
    hintMove,
    canUndo,
    selectCell,
    setAiDifficulty,
    setIsOpponentAiEnabled,
    restart,
    undo,
    showHint,
    replayTo,
    exitReplay,
  } = useGameController()

  useEffect(() => {
    savePreferences({
      themeId,
      pieceColorSelection,
      isOpponentAiEnabled,
      aiDifficulty,
    })
  }, [themeId, pieceColorSelection, isOpponentAiEnabled, aiDifficulty])

  // Restart/undo are the only exits from a finished game, so resetting the
  // dismissed flag here guarantees the overlay reappears for the next result.
  function handleRestart() {
    setIsOverlayDismissed(false)
    restart()
  }

  function handleUndo() {
    setIsOverlayDismissed(false)
    undo()
  }

  const aiDifficultyLabel =
    AI_DIFFICULTY_OPTIONS.find((option) => option.value === aiDifficulty)?.label ?? '普通'
  const pieceStyles = useMemo<Record<PlayerId, PieceVisualStyle>>(
    () => ({
      north: getPieceColorOption(pieceColorSelection.north),
      south: getPieceColorOption(pieceColorSelection.south),
    }),
    [pieceColorSelection],
  )
  const currentPlayerColor = pieceStyles[currentPlayer.id].color
  const themeDescription =
    THEME_OPTIONS.find((option) => option.id === themeId)?.description ?? THEME_OPTIONS[0].description
  const statusText = winner
    ? `${winner.name}獲勝`
    : game.isDraw
      ? '和局（雙方僵持，已達步數上限）'
    : isAiTurn
      ? `第 ${game.turn} 手，${currentPlayer.name} AI 思考中`
    : `第 ${game.turn} 手，輪到 ${currentPlayer.name}`

  function handleAiDifficultyChange(event: ChangeEvent<HTMLSelectElement>) {
    setAiDifficulty(event.currentTarget.value as AiDifficulty)
  }

  function setPieceColor(playerId: PlayerId, colorId: PieceColorId) {
    setPieceColorSelection((currentSelection) => ({
      ...currentSelection,
      [playerId]: colorId,
    }))
  }

  function handleToggleMute() {
    setIsMuted(soundManager.toggleMute())
  }

  function handleToggleBgm() {
    setIsBgmPlaying(soundManager.toggleBgm())
  }

  return (
    <main className="app-shell" data-theme={themeId}>
      <header className="app-header">
        <div>
          <p className="eyebrow">2D Core Prototype</p>
          <h1>中國跳棋</h1>
        </div>
        <div className="turn-badge" style={{ '--player-color': currentPlayerColor } as CSSProperties}>
          {statusText}
        </div>
      </header>

      <section className="game-layout">
        <div className="board-stage">
          <ChineseCheckersBoard
            game={viewedGame}
            selectedPieceId={isReplaying ? null : selectedPieceId}
            isInteractionDisabled={isAiTurn || isAiThinking || isReplaying}
            pieceStyles={pieceStyles}
            legalMoves={isReplaying ? [] : legalMoves}
            hintMove={isReplaying ? null : hintMove}
            onCellSelect={selectCell}
          />
        </div>

        <aside className="side-panel" aria-label="遊戲狀態">
          <section className="panel-section">
            <h2>目前狀態</h2>
            <dl className="status-list">
              <div>
                <dt>棋盤</dt>
                <dd>{BOARD_CELLS.length} 格</dd>
              </div>
              <div>
                <dt>回合</dt>
                <dd>{winner || game.isDraw ? '已結束' : isAiTurn ? 'AI 思考中' : currentPlayer.name}</dd>
              </div>
              <div>
                <dt>選取</dt>
                <dd>{selectedPiece ? selectedPiece.id : '尚未選棋'}</dd>
              </div>
              <div>
                <dt>可走</dt>
                <dd>{legalMoves.length} 格</dd>
              </div>
              <div>
                <dt>對手</dt>
                <dd>{isOpponentAiEnabled ? `${aiPlayer.name} AI（${aiDifficultyLabel}）` : '藍方玩家'}</dd>
              </div>
              <div>
                <dt>主題</dt>
                <dd>{THEME_OPTIONS.find((option) => option.id === themeId)?.label}</dd>
              </div>
            </dl>
          </section>

          <section className="panel-section">
            <MoveLog
              moveHistory={game.moveHistory}
              gamePlayers={game.players}
              onReplayTo={replayTo}
              activeIndex={replayIndex}
              onExitReplay={exitReplay}
            />
          </section>

          <section className="panel-section">
            <h2>外觀</h2>
            <div className="segmented-control" aria-label="主題色">
              {THEME_OPTIONS.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  className={theme.id === themeId ? 'is-active' : ''}
                  onClick={() => setThemeId(theme.id)}
                >
                  {theme.label}
                </button>
              ))}
            </div>
            <p className="control-note">{themeDescription}</p>

            <div className="color-picker-group">
              <p className="color-picker-title">紅方顏色</p>
              <div className="swatch-row" aria-label="紅方顏色">
                {PIECE_COLOR_OPTIONS.map((colorOption) => (
                  <button
                    key={colorOption.id}
                    type="button"
                    className={pieceColorSelection.north === colorOption.id ? 'color-swatch is-active' : 'color-swatch'}
                    style={{ '--swatch-color': colorOption.color } as CSSProperties}
                    aria-label={`紅方${colorOption.label}`}
                    title={`紅方${colorOption.label}`}
                    onClick={() => setPieceColor('north', colorOption.id)}
                  />
                ))}
              </div>
            </div>

            <div className="color-picker-group">
              <p className="color-picker-title">藍方顏色</p>
              <div className="swatch-row" aria-label="藍方顏色">
                {PIECE_COLOR_OPTIONS.map((colorOption) => (
                  <button
                    key={colorOption.id}
                    type="button"
                    className={pieceColorSelection.south === colorOption.id ? 'color-swatch is-active' : 'color-swatch'}
                    style={{ '--swatch-color': colorOption.color } as CSSProperties}
                    aria-label={`藍方${colorOption.label}`}
                    title={`藍方${colorOption.label}`}
                    onClick={() => setPieceColor('south', colorOption.id)}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="panel-section">
            <h2>AI 對手</h2>
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={isOpponentAiEnabled}
                onChange={(event) => setIsOpponentAiEnabled(event.currentTarget.checked)}
              />
              <span>藍方交給 AI</span>
            </label>
            <label className="select-control">
              <span>強度</span>
              <select
                value={aiDifficulty}
                onChange={handleAiDifficultyChange}
                disabled={!isOpponentAiEnabled}
              >
                {AI_DIFFICULTY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="control-note">
              {AI_DIFFICULTY_OPTIONS.find((option) => option.value === aiDifficulty)?.description}
            </p>
          </section>

          <section className="panel-section">
            <h2>聲音</h2>
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={!isMuted}
                onChange={handleToggleMute}
              />
              <span>音效</span>
            </label>
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={isBgmPlaying}
                onChange={handleToggleBgm}
              />
              <span>背景音樂</span>
            </label>
          </section>

          <section className="panel-section">
            <h2>操作</h2>
            <div className="button-row">
              <button type="button" onClick={showHint} disabled={isAiTurn || !!winner || game.isDraw || isAiThinking}>
                {isAiThinking ? '思考中...' : '提示'}
              </button>
              <button type="button" onClick={handleUndo} disabled={!canUndo || isAiThinking}>
                悔棋
              </button>
              <button type="button" onClick={handleRestart} disabled={isAiThinking}>
                重新開始
              </button>
            </div>
          </section>

          <section className="panel-section">
            <h2>規則核心</h2>
            <ul className="rule-list">
              <li>點自己的棋子後，綠色圈可直接落子。</li>
              <li>支援相鄰一步與跨棋跳躍，連跳會自動展開。</li>
              <li>任一方 10 顆棋全進入對面營區即獲勝。</li>
            </ul>
          </section>
        </aside>
      </section>

      {!isOverlayDismissed && (
        <VictoryOverlay
          winner={winner}
          isDraw={game.isDraw}
          turn={game.turn}
          onRestart={handleRestart}
          onClose={() => setIsOverlayDismissed(true)}
        />
      )}
    </main>
  )
}

export default App
