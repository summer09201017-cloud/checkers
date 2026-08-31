import { useEffect, useMemo, useRef, useState } from 'react'
import AiWorker from '../core/ai.worker?worker'
import {
  applyMove,
  createInitialGame,
  findLegalMove,
  getCurrentPlayer,
  getLegalMovesForPiece,
  getPiece,
  getPieceAt,
  getPlayer,
} from '../core'
import type { AiDifficulty, CellId, GameState, LegalMove, PieceId, PlayerId, TurnRecord } from '../core'
import { soundManager } from './sound'
import { saveGameState, loadGameState, clearGameState, loadPreferences } from './storage'
import { readSharedGame, clearShareHash } from './share'
import {
  DAILY_SET_SIZE,
  applyDailyResult,
  applyPuzzleMove,
  dailyKey,
  dailySolvedMap,
  gameFromPuzzle,
  isSolved,
  puzzlesForDate,
} from '../core/daily'
import type { DailyPuzzle } from '../core/daily'

const AI_PLAYER_ID: PlayerId = 'south'

// Rebuild the board as it stood after `moveCount` moves by replaying recorded
// moves from the initial position. moveHistory is engine-produced, so every
// replayed move is legal at its step.
function reconstructGameAt(history: TurnRecord[], moveCount: number): GameState {
  let state = createInitialGame()

  for (let index = 0; index < moveCount; index += 1) {
    state = applyMove(state, history[index])
  }

  return state
}

export function useGameController() {
  const prefs = useMemo(() => loadPreferences(), [])
  // A shared link wins over the locally saved game, then fall back to a new game.
  const [game, setGame] = useState<GameState>(
    () => readSharedGame() || loadGameState() || createInitialGame(),
  )
  const [selectedPieceId, setSelectedPieceId] = useState<PieceId | null>(null)
  const [pastGames, setPastGames] = useState<GameState[]>([])
  const [isOpponentAiEnabled, setIsOpponentAiEnabled] = useState(prefs.isOpponentAiEnabled)
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>(prefs.aiDifficulty)
  const [hintMove, setHintMove] = useState<LegalMove | null>(null)
  const [isAiThinking, setIsAiThinking] = useState(false)
  // Index into moveHistory currently being reviewed; null = following live play.
  const [replayIndex, setReplayIndex] = useState<number | null>(null)
  /* 📅 每日殘局:非 null = 正在解今天那一組的某一題(單人,沒有對手)。
     ★ AI 的 effect 看 isAiTurn,而每日模式 currentPlayerId 永遠是解題方
       ⇒ AI 天生不會被觸發,不用另外加開關。 */
  const [dailyPuzzle, setDailyPuzzle] = useState<DailyPuzzle | null>(null)
  const [dailySolvedAt, setDailySolvedAt] = useState<number | null>(null)   // 這題解出來時用了幾步
  /* 📅 今天已解的題:{ 題id: 最少步數 }。
     ★ 這份**進 state**(不是每次去讀 localStorage):進度要跟著「剛解完」立刻更新,
       而 localStorage 是外部可變狀態、React 看不到它的寫入。
       state 當唯一真相、localStorage 只負責持久化 ⇒ 依賴關係全是真的,不必騙 lint。 */
  const [dailySolved, setDailySolved] = useState<Record<string, number>>({})
  const workerRef = useRef<Worker>(null)

  useEffect(() => {
    workerRef.current = new AiWorker()
    return () => {
      workerRef.current?.terminate()
    }
  }, [])

  // We've consumed any shared-game link into initial state; clean it from the URL.
  useEffect(() => {
    clearShareHash()
  }, [])

  const currentPlayer = useMemo(() => getCurrentPlayer(game), [game])
  const aiPlayer = useMemo(() => getPlayer(game, AI_PLAYER_ID), [game])
  const winner = useMemo(() => (game.winnerId ? getPlayer(game, game.winnerId) : null), [game])
  const selectedPiece = useMemo(
    () => (selectedPieceId ? getPiece(game, selectedPieceId) : null),
    [game, selectedPieceId],
  )
  const legalMoves = useMemo<LegalMove[]>(
    () => (selectedPieceId ? getLegalMovesForPiece(game, selectedPieceId) : []),
    [game, selectedPieceId],
  )
  const isReplaying = replayIndex !== null
  // The board displays this; all game logic (AI, sound, save) still uses `game`.
  const viewedGame = useMemo(
    () => (replayIndex === null ? game : reconstructGameAt(game.moveHistory, replayIndex + 1)),
    [game, replayIndex],
  )
  const isAiTurn =
    isOpponentAiEnabled &&
    game.currentPlayerId === AI_PLAYER_ID &&
    !game.winnerId &&
    !game.isDraw

  useEffect(() => {
    if (game.winnerId) {
      soundManager.play('win')
    } else if (game.lastMove) {
      if (game.lastMove.kind === 'jump' && game.lastMove.path.length > 2) {
        soundManager.play('chainJump')
      } else {
        soundManager.play(game.lastMove.kind)
      }
    }
  }, [game.lastMove, game.winnerId])

  useEffect(() => {
    saveGameState(game)
  }, [game])

  useEffect(() => {
    setHintMove(null)
  }, [game.turn, selectedPieceId])

  useEffect(() => {
    if (!isAiTurn || !!game.winnerId || !isOpponentAiEnabled) {
      return
    }

    let canceled = false
    const timer = window.setTimeout(() => {
      if (canceled || !workerRef.current) return
      
      setSelectedPieceId(null)
      setIsAiThinking(true)

      const handleMessage = (e: MessageEvent) => {
        if (canceled) return
        const { move, id } = e.data
        if (id === 'turn') {
          setIsAiThinking(false)
          workerRef.current?.removeEventListener('message', handleMessage)
          
          if (!move) return
          
          setGame((currentGame) => {
            if (
              currentGame.winnerId ||
              currentGame.currentPlayerId !== AI_PLAYER_ID ||
              !isOpponentAiEnabled
            ) {
              return currentGame
            }
            setPastGames((history) => [...history, currentGame])
            return applyMove(currentGame, move)
          })
        }
      }

      workerRef.current.addEventListener('message', handleMessage)
      workerRef.current.postMessage({ state: game, difficulty: aiDifficulty, id: 'turn' })
    }, 250)

    return () => {
      canceled = true
      window.clearTimeout(timer)
      setIsAiThinking(false)
    }
  }, [game, aiDifficulty, isAiTurn, isOpponentAiEnabled])

  function selectCell(cellId: CellId) {
    if (game.winnerId || game.isDraw || isAiTurn || isReplaying) {
      return
    }

    const clickedPiece = getPieceAt(game, cellId)

    if (clickedPiece?.playerId === game.currentPlayerId) {
      soundManager.play('select')
      setSelectedPieceId(clickedPiece.id)
      return
    }

    if (selectedPieceId) {
      const move = findLegalMove(game, selectedPieceId, cellId)

      if (move) {
        setPastGames((history) => [...history, game])
        /* 📅 每日殘局:走完要把回合轉回解題方(單人題沒有對手)⇒ 走 applyPuzzleMove。
           解完的那一刻記成績(每題分開記、取最少步)。 */
        setGame((currentGame) => {
          if (!dailyPuzzle) return applyMove(currentGame, move)
          const next = applyPuzzleMove(currentGame, move)
          if (isSolved(next, dailyPuzzle)) {
            const moves = next.moveHistory.length
            const r = applyDailyResult(dailyPuzzle.key, dailyPuzzle.id, moves)   // 持久化
            setDailySolvedAt(moves)
            setDailySolved((m) => ({ ...m, [dailyPuzzle.id]: r.best }))          // state=唯一真相
            soundManager.play('win')
          }
          return next
        })
        setSelectedPieceId(null)
        return
      }
    }

    setSelectedPieceId(null)
  }

  function restart() {
    const newGame = createInitialGame()
    setGame(newGame)
    setPastGames([])
    setSelectedPieceId(null)
    setReplayIndex(null)
    setDailyPuzzle(null)      // 📅 一般開局=離開每日模式
    setDailySolvedAt(null)
    clearGameState()
  }

  /* 📅 每日殘局:開今天那一組的第 n 題(不給=今天還沒解的第一題;全解完 → 回第 1 題可重解)。 */
  function startDaily(n?: number) {
    const key = dailyKey()
    const set = puzzlesForDate(key)
    const solved = dailySolvedMap(key)
    const index = Number.isInteger(n)
      ? Math.max(0, Math.min(n as number, set.length - 1))
      : Math.max(0, set.findIndex((p) => !solved[p.id]))
    const puzzle = set[index]
    setDailyPuzzle(puzzle)
    setDailySolvedAt(null)
    setDailySolved(solved)        // 今天已解的題讀進 state(之後都以 state 為準)
    setGame(gameFromPuzzle(puzzle))
    setPastGames([])
    setSelectedPieceId(null)
    setReplayIndex(null)
  }

  /* 📅 今天那一組。★ 一定要 memo:puzzlesForDate 內含 BFS(一組約 0.3 秒),
     每次 render 重算會讓整個 UI 卡住。 */
  const dailySet = useMemo(
    () => (dailyPuzzle ? puzzlesForDate(dailyPuzzle.key) : null),
    [dailyPuzzle],
  )

  /** 📅 今天的進度(純粹從 state 算 ⇒ 依賴關係全是真的) */
  const dailyProgress = useMemo(() => {
    if (!dailyPuzzle || !dailySet) return null
    const done = dailySet.filter((p) => dailySolved[p.id]).length
    const nextIndex = dailySet.findIndex((p) => !dailySolved[p.id] && p.id !== dailyPuzzle.id)
    return { total: dailySet.length, done, solved: dailySolved, nextIndex, best: dailySolved[dailyPuzzle.id] ?? null }
  }, [dailyPuzzle, dailySet, dailySolved])

  // Replace the live game with an arbitrary state (e.g. from the position editor
  // or a loaded position), starting a fresh history from it.
  function loadGame(next: GameState) {
    setGame(next)
    setPastGames([])
    setSelectedPieceId(null)
    setReplayIndex(null)
  }

  // Review the position after move `index`. Clicking the latest move (or beyond)
  // snaps back to live play.
  function replayTo(index: number) {
    setReplayIndex(index >= game.moveHistory.length - 1 ? null : index)
    setSelectedPieceId(null)
  }

  function exitReplay() {
    setReplayIndex(null)
  }

  function undo() {
    setPastGames((history) => {
      const undoStepCount =
        isOpponentAiEnabled && game.lastMove?.playerId === AI_PLAYER_ID && history.length >= 2 ? 2 : 1
      const previousGame = history.at(-undoStepCount)

      if (!previousGame) {
        return history
      }

      soundManager.play('undo')
      setGame(previousGame)
      setSelectedPieceId(null)
      setReplayIndex(null)
      return history.slice(0, -undoStepCount)
    })
  }

  function showHint() {
    if (game.winnerId || game.isDraw || isAiTurn || !workerRef.current || isAiThinking) return
    
    setIsAiThinking(true)
    const handleMessage = (e: MessageEvent) => {
      const { move, id } = e.data
      if (id === 'hint') {
        setIsAiThinking(false)
        workerRef.current?.removeEventListener('message', handleMessage)
        setHintMove(move)
      }
    }
    workerRef.current.addEventListener('message', handleMessage)
    workerRef.current.postMessage({ state: game, difficulty: 'hard', id: 'hint' })
  }

  return {
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
    canUndo: pastGames.length > 0,
    selectCell,
    setAiDifficulty,
    setIsOpponentAiEnabled,
    restart,
    undo,
    showHint,
    replayTo,
    exitReplay,
    loadGame,
    // 📅 每日殘局
    dailyPuzzle,
    dailyProgress,
    dailySolvedAt,
    dailySetSize: DAILY_SET_SIZE,
    startDaily,
  }
}

/* 測試掛勾(驗收腳本用;艦隊慣例)——真人操作不經過它。
   ★ 只讀:驗收腳本要知道「這一題的目標格是哪幾格」才導航得動
     (產線 bundle 沒辦法 import 原始碼)。 */
export function exposeDailyHook(value: {
  puzzle: DailyPuzzle | null
  cells: string[]
  startDaily: (n?: number) => void
}) {
  ;(window as unknown as { __checkersDaily?: unknown }).__checkersDaily = value
}
