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

## Roadmap（已完成 vs 真正待做，對齊 2026-06-01）

> 詳細交接說明（架構、開發鐵則、待做規格）見 [`CLAUDE.md`](./CLAUDE.md)。
> 線上版：<https://chinese-checker.netlify.app/>

### ✅ 已完成（已上線）
- **核心**：121 格星形棋盤、每方 10 子、相鄰步 + 跨棋跳 + 連跳；2 人本機對戰。
- **AI 對手**：簡單 / 普通 / 困難，運算在 Web Worker（不卡畫面）。
- **體驗**：移動/連跳動畫、Web Audio 音效 + BGM、勝利煙火彈窗、**和局彈窗**、AI 提示、手機觸控放大。
- **棋局**：自動存檔（localStorage）、棋譜面板 + **回放**、悔棋、重新開始、**可分享網址**（把整局編碼進連結，對方開啟即重現）。
- **外觀**：清爽/木質/夜間/翡翠主題、雙方各 6 種棋子顏色。
- **手機版**：兩頁式版面（設定頁 → 全螢幕遊玩 + 底部工具列）；桌機維持側欄版面。
- **正確性修復**：原本「遊戲永遠不會結束」已修——AI 收尾不再卡死、封鎖死局解除（佔多數即勝）、
  加和局/步數上限、修掉移動動畫的當機/凍結。
- **工程**：可安裝 PWA（離線可玩、專屬圖示）、瀏覽器自動試玩（`npm run playtest`）、Netlify 自動部署。

### 🔲 真正待做
- 更強 AI（minimax/alpha-beta 加深、或 MCTS）。
- 本機多人（3–6 人）、3D renderer、線上對戰（依序加大）。

### ⚠️ 已知技術債
- 約 6 個既有 lint 警告（`set-state-in-effect` / `no-explicit-any`）在動畫/音效/worker 程式，
  非近期變更造成，暫留；不影響 build 與測試。

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
