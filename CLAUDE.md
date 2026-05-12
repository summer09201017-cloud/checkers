# CLAUDE.md - 中國跳棋專案指南

## GitHub Repository
此專案部署於：`https://github.com/summer09201017-cloud/checkers`

## 開發指令
- 啟動開發伺服器: `npm run dev`
- 執行測試: `npm run test`
- 程式碼檢查: `npm run lint`
- 建立正式版: `npm run build`

## 專案架構
- `src/core/`: 純 TypeScript 實作的核心遊戲邏輯、六角座標系計算、AI 演算法。不依賴任何 UI 框架。
- `src/app/`: React 狀態管理 (`useGameController`)、外觀設定、Web Audio API 音效 (`sound.ts`)、Local Storage 存檔 (`storage.ts`)、棋譜 (`MoveLog.tsx`) 與勝利畫面 (`VictoryOverlay.tsx`)。
- `src/renderers/svg2d/`: 負責將 `GameState` 繪製成 2D SVG 棋盤，包含棋子移動動畫、觸控事件處理。

## 最近更新重點 (2026-05)
1. **音效與音樂**：使用 Web Audio API 產生單步、連跳音效與隨機五聲音階背景音樂。
2. **動畫效果**：使用 `requestAnimationFrame` 實作棋子的滑動與連跳彈跳效果。
3. **體驗優化**：加入勝利煙火畫面、棋譜紀錄面板、AI 走步提示，並放大手機版的觸控範圍。
4. **自動存檔**：遊戲進度與偏好設定會即時保存至 `localStorage`。
