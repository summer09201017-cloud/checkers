import { useEffect, useRef } from 'react'
import type { Player } from '../core'
import './VictoryOverlay.css'

interface VictoryOverlayProps {
  winner: Player | null
  isDraw?: boolean
  turn: number
  onRestart: () => void
  onClose?: () => void
}

export function VictoryOverlay({ winner, isDraw = false, turn, onRestart, onClose }: VictoryOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!winner) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    const particles: any[] = []
    
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    window.addEventListener('resize', resize)
    resize()

    const createFirework = (x: number, y: number) => {
      const particleCount = 100
      const color = winner.color
      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = Math.random() * 6 + 2
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color,
          size: Math.random() * 4 + 2
        })
      }
    }

    const loop = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (Math.random() < 0.05) {
        createFirework(Math.random() * canvas.width, Math.random() * (canvas.height / 2))
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.vy += 0.1 // gravity
        p.x += p.vx
        p.y += p.vy
        p.life -= 0.015
        
        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }

        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      animationFrameId = requestAnimationFrame(loop)
    }

    loop()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [winner])

  if (!winner && !isDraw) return null

  // A draw has no champion, so use a neutral accent instead of a player colour.
  const accentColor = winner ? winner.color : '#6b7280'

  return (
    <div className="victory-overlay">
      {winner && <canvas ref={canvasRef} className="victory-canvas" />}
      <div className="victory-content" style={{ '--winner-color': accentColor } as React.CSSProperties}>
        {onClose && (
          <button className="victory-close" onClick={onClose} aria-label="關閉，回顧棋盤與棋譜" title="關閉，回顧棋盤與棋譜">
            ✕
          </button>
        )}
        <div className="victory-badge">{winner ? '🏆' : '🤝'}</div>
        <h2>{winner ? `${winner.name} 獲勝！` : '和局！'}</h2>
        <div className="victory-stats">
          {winner ? (
            <p>總計手數：<span>{turn} 手</span></p>
          ) : (
            <p>雙方僵持，已達步數上限 · <span>{turn} 手</span></p>
          )}
        </div>
        <button className="victory-button" onClick={onRestart}>
          再來一局
        </button>
      </div>
    </div>
  )
}
