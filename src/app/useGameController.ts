import { useEffect, useMemo, useState } from 'react'
import {
  applyMove,
  chooseAiMove,
  createInitialGame,
  findLegalMove,
  getCurrentPlayer,
  getLegalMovesForPiece,
  getPiece,
  getPieceAt,
  getPlayer,
} from '../core'
import type { AiDifficulty, CellId, GameState, LegalMove, PieceId, PlayerId } from '../core'

const AI_PLAYER_ID: PlayerId = 'south'

export function useGameController() {
  const [game, setGame] = useState<GameState>(() => createInitialGame())
  const [selectedPieceId, setSelectedPieceId] = useState<PieceId | null>(null)
  const [pastGames, setPastGames] = useState<GameState[]>([])
  const [isOpponentAiEnabled, setIsOpponentAiEnabled] = useState(true)
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>('normal')

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
    if (!isAiTurn) {
      return
    }

    const timer = window.setTimeout(() => {
      setSelectedPieceId(null)
      setGame((currentGame) => {
        if (
          currentGame.winnerId ||
          currentGame.currentPlayerId !== AI_PLAYER_ID ||
          !isOpponentAiEnabled
        ) {
          return currentGame
        }

        const move = chooseAiMove(currentGame, aiDifficulty)

        if (!move) {
          return currentGame
        }

        setPastGames((history) => [...history, currentGame])
        return applyMove(currentGame, move)
      })
    }, 550)

    return () => window.clearTimeout(timer)
  }, [aiDifficulty, isAiTurn, isOpponentAiEnabled])

  function selectCell(cellId: CellId) {
    if (game.winnerId || isAiTurn) {
      return
    }

    const clickedPiece = getPieceAt(game, cellId)

    if (clickedPiece?.playerId === game.currentPlayerId) {
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
    setGame(createInitialGame())
    setPastGames([])
    setSelectedPieceId(null)
  }

  function undo() {
    setPastGames((history) => {
      const undoStepCount =
        isOpponentAiEnabled && game.lastMove?.playerId === AI_PLAYER_ID && history.length >= 2 ? 2 : 1
      const previousGame = history.at(-undoStepCount)

      if (!previousGame) {
        return history
      }

      setGame(previousGame)
      setSelectedPieceId(null)
      return history.slice(0, -undoStepCount)
    })
  }

  return {
    game,
    currentPlayer,
    aiDifficulty,
    aiPlayer,
    winner,
    isAiTurn,
    isOpponentAiEnabled,
    selectedPiece,
    selectedPieceId,
    legalMoves,
    canUndo: pastGames.length > 0,
    selectCell,
    setAiDifficulty,
    setIsOpponentAiEnabled,
    restart,
    undo,
  }
}
