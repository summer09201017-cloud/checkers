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
        setGame((currentGame) => applyMove(currentGame, move))
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
    clearGameState()
  }

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
  }
}
