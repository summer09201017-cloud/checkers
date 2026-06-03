import { applyMove, createInitialGame, findLegalMove } from '../core'
import type { GameState } from '../core'

// Shareable-game links. We encode the *moveHistory* (much shorter than the full
// state) and rebuild the position by replaying it through the engine — which
// also re-validates every move, so a tampered/old link can never produce an
// illegal state. See the skill's references/game-modes.md.
const PARAM = 'g'
const VERSION = 1

function toBase64Url(text: string): string {
  // Payload is ASCII (piece ids + "q,r" cells + JSON punctuation), so btoa is safe.
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(code: string): string {
  const base64 = code.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  return atob(padded)
}

// Pure (no window) — unit-testable in Node.
export function encodeMoves(state: GameState): string {
  const moves = state.moveHistory.map((record) => [record.pieceId, record.to])
  return toBase64Url(JSON.stringify({ v: VERSION, m: moves }))
}

export function decodeMovesToGame(code: string): GameState | null {
  try {
    const data = JSON.parse(fromBase64Url(code)) as { v?: number; m?: unknown }

    if (data.v !== VERSION || !Array.isArray(data.m)) {
      return null
    }

    let state = createInitialGame()
    for (const entry of data.m) {
      if (!Array.isArray(entry)) {
        return null
      }
      const [pieceId, to] = entry as [string, string]
      const move = findLegalMove(state, pieceId, to)
      if (!move) {
        return null // illegal/old link → caller falls back to a fresh game
      }
      state = applyMove(state, move)
    }

    return state
  } catch {
    return null
  }
}

// Window-dependent helpers (used by the controller / UI).
export function buildShareUrl(state: GameState): string {
  const url = new URL(window.location.href)
  url.hash = `${PARAM}=${encodeMoves(state)}`
  return url.toString()
}

export function readSharedGame(): GameState | null {
  if (typeof window === 'undefined') {
    return null
  }
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const code = params.get(PARAM)
  return code ? decodeMovesToGame(code) : null
}

// Drop the link from the address bar after we've loaded it, so the user's own
// play (and a refresh) isn't pinned to the shared game.
export function clearShareHash(): void {
  if (typeof window !== 'undefined' && window.location.hash.includes(`${PARAM}=`)) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }
}
