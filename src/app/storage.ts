import type { GameState } from '../core'
import type { ThemeId, PieceColorSelection } from './appearance'
import { DEFAULT_PIECE_COLORS } from './appearance'
import type { AiDifficulty } from '../core'

const STORAGE_KEY_GAME = '23d_co_game'
const STORAGE_KEY_PREFS = '23d_co_prefs'

interface GamePreferences {
  themeId: ThemeId
  pieceColorSelection: PieceColorSelection
  isOpponentAiEnabled: boolean
  aiDifficulty: AiDifficulty
}

export function saveGameState(state: GameState) {
  try {
    localStorage.setItem(STORAGE_KEY_GAME, JSON.stringify(state))
  } catch (e) {
    console.error('Failed to save game state', e)
  }
}

export function loadGameState(): GameState | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY_GAME)
    if (!data) return null
    return JSON.parse(data) as GameState
  } catch (e) {
    console.error('Failed to load game state', e)
    return null
  }
}

export function clearGameState() {
  localStorage.removeItem(STORAGE_KEY_GAME)
}

export function savePreferences(prefs: GamePreferences) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(prefs))
  } catch (e) {
    console.error('Failed to save preferences', e)
  }
}

export function loadPreferences(): GamePreferences {
  const defaults: GamePreferences = {
    themeId: 'classic',
    pieceColorSelection: DEFAULT_PIECE_COLORS,
    isOpponentAiEnabled: true,
    aiDifficulty: 'normal',
  }

  try {
    const data = localStorage.getItem(STORAGE_KEY_PREFS)
    if (!data) return defaults
    return { ...defaults, ...JSON.parse(data) }
  } catch (e) {
    console.error('Failed to load preferences', e)
    return defaults
  }
}
