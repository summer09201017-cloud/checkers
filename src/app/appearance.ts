import type { PlayerId } from '../core'

export type ThemeId = 'classic' | 'wood' | 'night' | 'jade'
export type PieceColorId = 'ruby' | 'ocean' | 'jade' | 'gold' | 'violet' | 'slate'

export interface ThemeOption {
  id: ThemeId
  label: string
  description: string
}

export interface PieceColorOption {
  id: PieceColorId
  label: string
  color: string
  dark: string
  light: string
}

export type PieceColorSelection = Record<PlayerId, PieceColorId>

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'classic',
    label: '清爽',
    description: '明亮乾淨，適合長時間遊玩。',
  },
  {
    id: 'wood',
    label: '木質',
    description: '溫暖棋盤感，對比柔和。',
  },
  {
    id: 'night',
    label: '夜間',
    description: '低亮度深色介面，適合夜晚。',
  },
  {
    id: 'jade',
    label: '翡翠',
    description: '清透綠色系，棋格辨識度高。',
  },
]

export const PIECE_COLOR_OPTIONS: PieceColorOption[] = [
  {
    id: 'ruby',
    label: '紅玉',
    color: '#d84e45',
    dark: '#8d252b',
    light: '#ffb1a8',
  },
  {
    id: 'ocean',
    label: '海藍',
    color: '#2f6dd6',
    dark: '#173f86',
    light: '#9fc2ff',
  },
  {
    id: 'jade',
    label: '翡翠',
    color: '#18886f',
    dark: '#0f5d51',
    light: '#92dfcb',
  },
  {
    id: 'gold',
    label: '金珀',
    color: '#d99a22',
    dark: '#8c5c10',
    light: '#ffd889',
  },
  {
    id: 'violet',
    label: '紫晶',
    color: '#7c5ac7',
    dark: '#473080',
    light: '#c7b7ff',
  },
  {
    id: 'slate',
    label: '墨石',
    color: '#526173',
    dark: '#243042',
    light: '#bcc8d6',
  },
]

export const DEFAULT_PIECE_COLORS: PieceColorSelection = {
  north: 'ruby',
  south: 'ocean',
}

export function getPieceColorOption(colorId: PieceColorId): PieceColorOption {
  const color = PIECE_COLOR_OPTIONS.find((option) => option.id === colorId)

  if (!color) {
    throw new Error(`Unknown piece color: ${colorId}`)
  }

  return color
}
