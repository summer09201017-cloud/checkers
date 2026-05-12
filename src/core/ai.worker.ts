import { chooseAiMove } from './ai'
import type { GameState } from './types'
import type { AiDifficulty } from './ai'

self.onmessage = (event: MessageEvent<{ state: GameState; difficulty: AiDifficulty; id?: string }>) => {
  const { state, difficulty, id } = event.data
  
  // Perform heavy calculation synchronously in this worker thread
  const move = chooseAiMove(state, difficulty)
  
  // Post the result back to the main thread
  self.postMessage({ move, id })
}
