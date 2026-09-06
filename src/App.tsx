import { AI_DIFFICULTY_OPTIONS, BOARD_CELLS } from './core'
import { exposeDailyHook, useGameController } from './app/useGameController'
import { MoveLog } from './app/MoveLog'
import { VictoryOverlay } from './app/VictoryOverlay'
import { PositionEditor } from './app/PositionEditor'
import { ChineseCheckersBoard } from './renderers/svg2d/ChineseCheckersBoard'
import {
  PIECE_COLOR_OPTIONS,
  THEME_OPTIONS,
  getPieceColorOption,
} from './app/appearance'
import { loadPreferences, savePreferences } from './app/storage'
import { soundManager } from './app/sound'
import { useMediaQuery } from './app/useMediaQuery'
import { buildShareUrl } from './app/share'
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
  const [shareCopied, setShareCopied] = useState(false)
  const [editorActive, setEditorActive] = useState(false)
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [mobileView, setMobileView] = useState<'setup' | 'play'>('setup')
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
    loadGame,
    dailyPuzzle,
    dailyProgress,
    dailySolvedAt,
    startDaily,
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

  function handleShare() {
    const url = buildShareUrl(game)
    void navigator.clipboard?.writeText(url).catch(() => {})
    setShareCopied(true)
    window.setTimeout(() => setShareCopied(false), 1800)
  }

  const shareButton = (
    <button type="button" onClick={handleShare} title="複製這局的分享連結">
      {shareCopied ? '已複製連結 ✓' : '分享連結'}
    </button>
  )

  const editorButton = (
    <button type="button" onClick={() => setEditorActive(true)} title="開啟盤面編輯器（出題／教學／測試）">
      盤面編輯器
    </button>
  )

  // --- Reusable pieces, shared by the desktop side panel and the mobile setup screen ---
  const boardEl = (
    <ChineseCheckersBoard
      game={viewedGame}
      selectedPieceId={isReplaying ? null : selectedPieceId}
      isInteractionDisabled={isAiTurn || isAiThinking || isReplaying}
      pieceStyles={pieceStyles}
      legalMoves={isReplaying ? [] : legalMoves}
      hintMove={isReplaying ? null : hintMove}
      onCellSelect={selectCell}
    />
  )

  const appearanceSection = (
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
  )

  const aiSection = (
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
        <select value={aiDifficulty} onChange={handleAiDifficultyChange} disabled={!isOpponentAiEnabled}>
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
  )

  const soundSection = (
    <section className="panel-section">
      <h2>聲音</h2>
      <label className="checkbox-control">
        <input type="checkbox" checked={!isMuted} onChange={handleToggleMute} />
        <span>音效</span>
      </label>
      <label className="checkbox-control">
        <input type="checkbox" checked={isBgmPlaying} onChange={handleToggleBgm} />
        <span>背景音樂</span>
      </label>
    </section>
  )

  /* 📅 測試掛勾:驗收腳本要知道「這題的目標格」才導航得動(產線 bundle 不能 import 原始碼) */
  useEffect(() => {
    exposeDailyHook({
      puzzle: dailyPuzzle,
      cells: game.pieces.map((p) => p.cellId),
      startDaily,
    })
  }, [dailyPuzzle, game, startDaily])

  /* 🔗 ?daily 深連結(0906,信友火花「今日挑戰」卡直達):等於代按「📅 每日殘局」——只在開站那一刻看一次網址。 */
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).has('daily')) startDaily()
    } catch {
      /* 網址解析失敗就當沒帶 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* 📅 每日殘局(跳棋・D 型)。桌機側欄與手機設定頁共用同一段 JSX。
     ★ 解完了才出現「下一題」——沒解完給那顆會讓孩子以為可以跳過。 */
  const dailySection = (
    <section className="panel-section">
      <h2>📅 每日殘局</h2>
      {dailyPuzzle ? (
        <>
          <p className="rule-list" style={{ listStyle: 'none', margin: '0 0 8px', lineHeight: 1.7 }}>
            {dailyPuzzle.key} 第 {dailyPuzzle.n + 1}/{dailyProgress?.total ?? 5} 題
            (今天已解 {dailyProgress?.done ?? 0} 題)
            <br />
            目標:<b>{dailyPuzzle.minMoves} 步</b>把 {dailyPuzzle.start.length} 顆棋子全部走進對面營區
            ・已走 <b>{game.moveHistory.length}</b> 步
            {dailyProgress?.best ? `(這題你的最佳:${dailyProgress.best} 步)` : ''}
            <br />
            <span style={{ opacity: 0.8 }}>{dailyPuzzle.hint}</span>
          </p>
          {dailySolvedAt !== null && (
            <p className="rule-list" style={{ listStyle: 'none', margin: '0 0 8px', fontWeight: 700 }}>
              🎉 解出來了!用了 {dailySolvedAt} 步
              {dailySolvedAt <= dailyPuzzle.minMoves ? '——最少步數,滿分!' : `(最少 ${dailyPuzzle.minMoves} 步)`}
            </p>
          )}
          <div className="button-row">
            {dailySolvedAt !== null && (dailyProgress?.nextIndex ?? -1) >= 0 && (
              <button type="button" onClick={() => startDaily(dailyProgress?.nextIndex)}>
                📅 下一題
              </button>
            )}
            <button type="button" onClick={() => startDaily(dailyPuzzle.n)}>
              🔁 這題重來
            </button>
            <button type="button" onClick={handleRestart}>
              離開每日殘局
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="rule-list" style={{ listStyle: 'none', margin: '0 0 8px', lineHeight: 1.7 }}>
            每天一組 <b>5 題</b>、全世界同一組:把幾顆棋子在最少步數內全部走進對面營區。
            每一題的最少步數都由電腦窮舉算過,不是猜的。
          </p>
          <div className="button-row">
            <button type="button" onClick={() => startDaily()}>
              📅 開始今天的每日殘局
            </button>
          </div>
        </>
      )}
    </section>
  )

  /* 版本簡歷(game-must-haves ⑦):讓使用者判斷自己開到的是不是新版。
     ★ 寫死在畫面上,不從 SW 問——JS 掛了也還看得到。 */
  const verTagSection = (
    <section className="panel-section">
      <p style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.7, margin: 0 }}>
        版本 v3(2026-09-06)・🔗 <b>網址加 ?daily 直接開每日殘局</b>(信友火花「今日挑戰」卡點了就進今天的題,不用再按每日鈕)。
        <br />
        前幾版:v2 📅 每日殘局:每天一組 5 題、全世界同一組,最少步數內把棋子全走進對面營區,每題的最少步數都由電腦窮舉算過(2026-08-31)・v1 中國跳棋(對 AI 三檔/悔棋/棋譜回放/盤面編輯器/可分享連結/PWA)
      </p>
    </section>
  )

  const rulesSection = (
    <section className="panel-section">
      <h2>規則核心</h2>
      <ul className="rule-list">
        <li>點自己的棋子後，綠色圈可直接落子。</li>
        <li>支援相鄰一步與跨棋跳躍，連跳會自動展開。</li>
        <li>任一方 10 顆棋全進入對面營區即獲勝。</li>
      </ul>
    </section>
  )

  const overlayEl = !isOverlayDismissed && (
    <VictoryOverlay
      winner={winner}
      isDraw={game.isDraw}
      turn={game.turn}
      onRestart={handleRestart}
      onClose={() => setIsOverlayDismissed(true)}
    />
  )

  // ===== Position editor (takes over the whole screen on any device) =====
  if (editorActive) {
    return (
      <PositionEditor
        initialGame={game}
        themeId={themeId}
        pieceStyles={pieceStyles}
        onApply={(state) => {
          loadGame(state)
          setIsOverlayDismissed(false)
          setEditorActive(false)
          if (isMobile) {
            setMobileView('play')
          }
        }}
        onCancel={() => setEditorActive(false)}
      />
    )
  }

  // ===== Mobile: two-screen flow (setup → full-screen play) =====
  if (isMobile) {
    if (mobileView === 'play') {
      return (
        <main className="app-shell" data-theme={themeId} data-mobile="play">
          <div className="mobile-play">
            <div
              className={isReplaying ? 'm-statusbar is-replay' : 'm-statusbar'}
              style={{ '--player-color': currentPlayerColor } as CSSProperties}
              onClick={isReplaying ? exitReplay : undefined}
            >
              {isReplaying
                ? `🔁 回放：第 ${(replayIndex ?? 0) + 1} 手 · 點此返回實況`
                : statusText}
            </div>
            <div className="m-board">{boardEl}</div>
            <nav className="m-toolbar" aria-label="遊戲操作">
              <button
                type="button"
                onClick={showHint}
                disabled={isAiTurn || !!winner || game.isDraw || isAiThinking || isReplaying}
              >
                {isAiThinking ? '思考中' : '提示'}
              </button>
              <button type="button" onClick={handleUndo} disabled={!canUndo || isAiThinking}>
                悔棋
              </button>
              <button type="button" onClick={handleRestart} disabled={isAiThinking}>
                重來
              </button>
              <button type="button" onClick={() => setMobileView('setup')}>
                ⚙ 設定
              </button>
            </nav>
          </div>
          {overlayEl}
        </main>
      )
    }

    return (
      <main className="app-shell" data-theme={themeId} data-mobile="setup">
        <div className="mobile-setup">
          <header className="app-header">
            <div>
              <p className="eyebrow">中國跳棋</p>
              <h1>遊戲設定</h1>
            </div>
          </header>
          <div className="m-setup-scroll">
            {dailySection}
            {appearanceSection}
            {aiSection}
            {soundSection}
            <section className="panel-section">
              <MoveLog
                moveHistory={game.moveHistory}
                gamePlayers={game.players}
                onReplayTo={(index) => {
                  replayTo(index)
                  setMobileView('play')
                }}
                activeIndex={replayIndex}
              />
            </section>
            <section className="panel-section">
              <h2>分享 / 工具</h2>
              <div className="button-row">
                {shareButton}
                {editorButton}
              </div>
            </section>
            {rulesSection}
            {verTagSection}
          </div>
          <button type="button" className="m-start" onClick={() => setMobileView('play')}>
            {game.moveHistory.length > 0 && !winner && !game.isDraw ? '繼續對局' : '開始遊戲'}
          </button>
        </div>
        {overlayEl}
      </main>
    )
  }

  // ===== Desktop: header + board + side panel =====
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
        <div className="board-stage">{boardEl}</div>

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

          {appearanceSection}
          {aiSection}
          {soundSection}

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
              {shareButton}
              {editorButton}
            </div>
          </section>

          {dailySection}

          {rulesSection}
          {verTagSection}
        </aside>
      </section>

      {overlayEl}
    </main>
  )
}

export default App
