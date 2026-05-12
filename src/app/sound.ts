export type SoundType = 'step' | 'jump' | 'chainJump' | 'select' | 'win' | 'undo'

class SoundManager {
  private audioContext: AudioContext | null = null
  private isMuted = false
  private bgmOscillator: OscillatorNode | null = null
  private bgmGain: GainNode | null = null
  private isBgmPlaying = false
  private bgmTimer: number | null = null
  
  constructor() {
    this.isMuted = localStorage.getItem('23d_co_muted') === 'true'
    this.isBgmPlaying = localStorage.getItem('23d_co_bgm') === 'true'
  }

  public init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      // Start BGM if it was playing previously
      if (this.isBgmPlaying && !this.bgmOscillator) {
        this.startBgm()
      }
    }
  }

  public toggleMute() {
    this.isMuted = !this.isMuted
    localStorage.setItem('23d_co_muted', String(this.isMuted))
    return this.isMuted
  }
  
  public getMuted() {
    return this.isMuted
  }
  
  public toggleBgm() {
    this.init() // Ensure AudioContext is ready
    this.isBgmPlaying = !this.isBgmPlaying
    localStorage.setItem('23d_co_bgm', String(this.isBgmPlaying))
    
    if (this.isBgmPlaying) {
      this.startBgm()
    } else {
      this.stopBgm()
    }
    return this.isBgmPlaying
  }
  
  public getBgmPlaying() {
    return this.isBgmPlaying
  }

  private playTone(freq: number, type: OscillatorType, duration: number, vol = 0.1) {
    if (this.isMuted || !this.audioContext) return

    const osc = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(freq, this.audioContext.currentTime)

    gainNode.gain.setValueAtTime(vol, this.audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration)

    osc.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    osc.start()
    osc.stop(this.audioContext.currentTime + duration)
  }

  public play(type: SoundType) {
    this.init() // Try to initialize if not already
    if (this.isMuted || !this.audioContext) return

    switch (type) {
      case 'select':
        this.playTone(440, 'sine', 0.1, 0.05) // A4
        break
      case 'step':
        this.playTone(330, 'triangle', 0.15, 0.08) // E4
        break
      case 'jump':
        this.playTone(659.25, 'sine', 0.2, 0.1) // E5
        break
      case 'chainJump':
        this.playTone(880, 'sine', 0.2, 0.12) // A5
        break
      case 'undo':
        this.playTone(220, 'triangle', 0.3, 0.1) // A3
        break
      case 'win':
        // Arpeggio C major
        setTimeout(() => this.playTone(523.25, 'square', 0.3, 0.1), 0) // C5
        setTimeout(() => this.playTone(659.25, 'square', 0.3, 0.1), 150) // E5
        setTimeout(() => this.playTone(783.99, 'square', 0.3, 0.1), 300) // G5
        setTimeout(() => this.playTone(1046.50, 'square', 0.6, 0.15), 450) // C6
        break
    }
  }
  
  private startBgm() {
    if (!this.audioContext || this.bgmOscillator) return
    
    // Pentatonic scale (C, D, E, G, A) frequencies
    const pentatonic = [261.63, 293.66, 329.63, 392.00, 440.00]
    
    const playNote = () => {
      if (!this.isBgmPlaying || !this.audioContext) return
      
      const freq = pentatonic[Math.floor(Math.random() * pentatonic.length)]
      
      this.bgmOscillator = this.audioContext.createOscillator()
      this.bgmGain = this.audioContext.createGain()
      
      this.bgmOscillator.type = 'sine'
      this.bgmOscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime)
      
      this.bgmGain.gain.setValueAtTime(0, this.audioContext.currentTime)
      this.bgmGain.gain.linearRampToValueAtTime(0.03, this.audioContext.currentTime + 1)
      this.bgmGain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 3)
      
      this.bgmOscillator.connect(this.bgmGain)
      this.bgmGain.connect(this.audioContext.destination)
      
      this.bgmOscillator.start()
      this.bgmOscillator.stop(this.audioContext.currentTime + 3)
      
      this.bgmTimer = window.setTimeout(playNote, 2500 + Math.random() * 2000)
    }
    
    playNote()
  }
  
  private stopBgm() {
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer)
      this.bgmTimer = null
    }
    if (this.bgmOscillator && this.bgmGain && this.audioContext) {
      this.bgmGain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 1)
      setTimeout(() => {
        if (this.bgmOscillator) {
          try { this.bgmOscillator.stop() } catch (e) {}
          this.bgmOscillator = null
        }
      }, 1000)
    } else {
        this.bgmOscillator = null;
    }
  }
}

export const soundManager = new SoundManager()
