import type { TurnRecord } from '../core'
import { getPlayer, createInitialGame } from '../core'
import './MoveLog.css'

interface MoveLogProps {
  moveHistory: TurnRecord[]
  gamePlayers: ReturnType<typeof createInitialGame>['players']
  onReplayTo?: (turnIndex: number) => void
}

export function MoveLog({ moveHistory, gamePlayers, onReplayTo }: MoveLogProps) {
  function handleExport() {
    const text = moveHistory
      .map((record, index) => {
        const player = gamePlayers.find(p => p.id === record.playerId)?.name || record.playerId
        const type = record.kind === 'jump' ? '跳躍' : '移動'
        return `${index + 1}. ${player} ${type} ${record.from} -> ${record.to}`
      })
      .join('\n')
      
    navigator.clipboard.writeText(text).then(() => {
      alert('已複製棋譜到剪貼簿！')
    })
  }

  return (
    <div className="move-log">
      <div className="move-log-header">
        <h3 className="move-log-title">對局記錄 ({moveHistory.length})</h3>
        {moveHistory.length > 0 && (
          <button className="export-button" onClick={handleExport} title="複製棋譜">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
        )}
      </div>
      <div className="move-list-container">
        {moveHistory.length === 0 ? (
          <div className="move-empty">尚無記錄</div>
        ) : (
          <ol className="move-list">
            {moveHistory.map((record, index) => {
              const player = gamePlayers.find(p => p.id === record.playerId)
              return (
                <li key={index} className="move-item">
                  <span className="move-num">{index + 1}.</span>
                  <span 
                    className="move-player" 
                    style={{ color: player?.color }}
                  >
                    {player?.name[0]}
                  </span>
                  <span className="move-detail">
                    {record.from} → {record.to}
                    {record.kind === 'jump' && <span className="move-badge">跳</span>}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
