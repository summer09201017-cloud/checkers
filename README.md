# 中國跳棋 2D Core Prototype

使用 TypeScript + Vite + React 建立的中國跳棋原型。現階段先完成 2D SVG 棋盤與核心規則，之後可以在不重寫規則的情況下替換成 3D renderer。

## 開發指令

```bash
npm install
npm run dev
npm run test
npm run lint
npm run build
```

### 自動試玩（瀏覽器端測試）

`npm run test` 只測純規則引擎（`src/core/`），測不到畫面 / 動畫 / Web Worker 的當機與凍結。
`npm run playtest` 會用無頭瀏覽器**真的把遊戲玩起來**（清存檔 → 設難度 → 自動走合法步 → 等 AI →
全程監看 console），抓出邏輯測試看不到的當機/凍結。當初的「移動動畫凍結」就是靠它抓到的。

```bash
npx playwright install chromium          # 只需一次，下載瀏覽器
npm run dev                              # 另開一個終端機
npm run playtest                         # 本機測試（預設 localhost:5173、困難難度）
URL=https://chinese-checker.netlify.app/ npm run playtest   # 測線上部署版
ROUNDS=30 DIFFICULTY=normal npm run playtest                # 可調回合數 / 難度
```

有任何 console / 頁面錯誤或棋盤凍結，腳本會以非 0 結束（可接 CI）。

## 目前功能

- 2 人本機對戰：紅方與藍方。
- 標準中國跳棋 121 格星形棋盤，每方 10 顆棋。
- 支援相鄰一步、跨棋跳躍與連跳合法目的地展開。
- **[新]** 棋子移動平滑動畫，連跳時具有物理彈跳感。
- **[新]** Web Audio API 程式化生成的遊戲音效與中國風五聲音階背景音樂。
- **[新]** 遊戲進度與偏好設定自動存檔至 localStorage。
- **[新]** 棋譜記錄面板，支援紀錄回看與文字匯出。
- **[新]** 勝利慶祝畫面與煙火粒子特效。
- **[新]** AI 提示功能，計算最佳走法並在棋盤上繪製路徑。
- **[新]** 手機版觸控優化（加大隱藏點擊區、自適應抽屜式操作列）。
- 藍方可交給 AI，並可選擇簡單、普通、困難強度。
- 可切換清爽、木質、夜間、翡翠主題。
- 可替紅方與藍方分別選擇 6 種材質的棋子顏色。
- 悔棋與重新開始。

## GitHub Repository
[https://github.com/summer09201017-cloud/checkers](https://github.com/summer09201017-cloud/checkers)

## 架構

```txt
src/
  core/                    純 TypeScript 規則與棋盤模型
    ai.ts                  AI 選步策略
  app/                     React 遊戲控制器與外觀設定
  renderers/svg2d/         目前的 2D SVG 棋盤 renderer
```

`core/` 不依賴 React 或 DOM，因此之後可以新增 Three.js renderer，共用同一套棋盤與規則邏輯。
