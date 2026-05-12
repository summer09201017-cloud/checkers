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
import type { AiDifficulty, CellId, GameState, LegalMove, PieceId, PlayerId } from '../core'
import { soundManager } from './sound'
import { saveGameState, loadGameState, clearGameState, loadPreferences } from './storage'

const AI_PLAYER_ID: PlayerId = 'south'

export function useGameController() {
  const prefs = useMemo(() => loadPreferences(), [])
  const [game, setGame] = useState<GameState>(() => loadGameState() || createInitialGame())
  const [selectedPieceId, setSelectedPieceId] = useState<PieceId | null>(null)
  const [pastGames, setPastGames] = useState<GameState[]>([])
  const [isOpponentAiEnabled, setIsOpponentAiEnabled] = useState(prefs.isOpponentAiEnabled)
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>(prefs.aiDifficulty)
  const [hintMove, setHintMove] = useState<LegalMove | null>(null)
  const [isAiThinking, setIsAiThinking] = useState(false)
  const workerRef = useRef<Worker>(null)

  useEffect(() => {
    workerRef.current = new AiWorker()
    return () => {
      workerRef.current?.terminate()
    }
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
  const isAiTurn = isOpponentAiEnabled && game.currentPlayerId === AI_PLAYER_ID && !game.winnerId

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
    if (game.winnerId || isAiTurn) {
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
    clearGameState()
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
      return history.slice(0, -undoStepCount)
    })
  }

  function showHint() {
    if (game.winnerId || isAiTurn || !workerRef.current || isAiThinking) return
    
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
  }
}
